import { ChatOpenAI } from "@langchain/openai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiKey } from "src/api-keys/entities/api-key.entity";
import { Repository } from "typeorm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { BookChapterGenerationDto } from "./dto/book-chapter.dto";
import { BookGeneration } from "src/book-generation/entities/book-generation.entity";
import { BookChapter } from "./entities/book-chapter.entity";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import axios from "axios";
@Injectable()
export class BookChapterService {
  private textModel;
  private apiKeyRecord;
  private openai: OpenAI;
  private readonly logger = new Logger(BookChapterService.name);
  private readonly uploadsDir: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>,

    @InjectRepository(BookChapter)
    private bookChapterRepository: Repository<BookChapter>,

    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>
  ) {
    this.uploadsDir = this.setupUploadsDirectory();
  }

  private setupUploadsDirectory(): string {
    const rootDir = process.cwd();
    const uploadsPath = path.join(rootDir, "uploads");

    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      const directories = ["covers", "chapters", "temp", "graphs"];
      directories.forEach((dir) => {
        const dirPath = path.join(uploadsPath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });

      this.logger.log(`Uploads directory setup complete at: ${uploadsPath}`);
      return uploadsPath;
    } catch (error) {
      this.logger.error(`Error setting up uploads directory: ${error.message}`);
      throw new Error("Failed to setup uploads directory");
    }
  }
  private async initializeAIModels() {
    try {
      this.apiKeyRecord = await this.apiKeyRepository.find();
      if (!this.apiKeyRecord) {
        throw new Error("No API keys found in the database.");
      }

      this.textModel = new ChatOpenAI({
        openAIApiKey: this.apiKeyRecord[0].openai_key,
        temperature: 0.7,
        maxTokens: 16000,
        modelName: this.apiKeyRecord[0].model,
      });

      this.openai = new OpenAI({
        apiKey: this.apiKeyRecord[0].dalle_key,
      });

      this.logger.log(
        `AI Models initialized successfully with model: ${this.apiKeyRecord[0].model}`
      );
    } catch (error) {
      this.logger.error(`Failed to initialize AI models: ${error.message}`);
      throw new Error("Failed to initialize AI models.");
    }
  }

  private async invokeWithSimulatedStreaming(
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await this.textModel.invoke(prompt);
    const content = response.content;
    if (!content) {
      throw new Error("No content returned");
    }
    const lines = content.split("\n");
    for (const line of lines) {
      onToken(line + "\n");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return content;
  }

  private async saveImage(
    imageData: string,
    fileName: string,
    subDirectory: string = "covers"
  ): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, subDirectory);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fullFileName = `${sanitizedFileName}_${timestamp}.png`;
      const filePath = path.join(dirPath, fullFileName);

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filePath, base64Data, { encoding: "base64" });

      this.logger.log(`Image saved successfully: ${filePath}`);
      return path.join(subDirectory, fullFileName);
    } catch (error) {
      this.logger.error(`Error saving image: ${error.message}`);
      throw new Error("Failed to save image");
    }
  }

  private async saveGeneratedImage(
    responseUrl: string,
    bookTitle: string
  ): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, "chapters");
      const baseUrl = this.configService.get<string>("BASE_URL");
      const maxRetries = 5; // Adjust the number of retries as needed
      const delayMs = 2000; // Wait time before retrying (2 seconds)
  
      let imageUrl = null;
      let attempt = 0;
  
      while (attempt < maxRetries) {
        try {
          const getResponse = await axios.get(responseUrl, {
            headers: {
              Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
              "Content-Type": "application/json",
            },
          });
  
          if (getResponse.data.images && getResponse.data.images.length > 0) {
            imageUrl = getResponse.data.images[0].url;
            break; // Exit loop once the image is available
          }
        } catch (error) {
          if (error.response?.status === 400 || error.response?.status === 401) {
            this.logger.warn(`Retrying fetch image (Attempt ${attempt + 1}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delayMs)); // Wait before retrying
            attempt++;
            continue;
          } else {
            throw new Error(`Error fetching image: ${error.message}`);
          }
        }
      }
  
      if (!imageUrl) {
        throw new Error("Failed to fetch image after multiple attempts.");
      }
  
      // Fetch the image binary
      const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
  
      // Generate filename
      const timestamp = new Date().getTime();
      const sanitizedFileName = bookTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const fullFileName = `${sanitizedFileName}_chapter_image_${timestamp}.png`;
      const imagePath = path.join(dirPath, fullFileName);
  
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
  
      // Save image
      fs.writeFileSync(imagePath, imageResponse.data);
  
      return `${baseUrl}/uploads/chapters/${fullFileName}`;
    } catch (error) {
      this.logger.error(`Error saving generated chapter image: ${error.message}`);
      throw new Error(error.message);
    }
  }
  

  private async ChapterContent(
    promptData: BookChapterGenerationDto,
    bookInfo: BookGeneration,
    onTextUpdate: (text: string) => void
  ): Promise<string> {
    try {
      // Initialize memory for conversation context
      const memory = new ConversationSummaryBufferMemory({
        llm: this.textModel, // Uses the model to generate summaries automatically
        memoryKey: "chapter_summary", // Stores summarized chapter details
        returnMessages: true, // Ensures memory retains past summaries
      });

      const imageCount = Math.floor(Math.random() * 2) + 2; // Generate 2 or 3 images
      const totalImages = Math.min(+promptData.noOfImages, imageCount);
      const chapterImages: { title: string; url: string }[] = [];


      for (let imageIndex = 1; imageIndex <= totalImages; imageIndex++) {
        const imageTitlePrompt = `
          Provide a short but descriptive title for an illustration in Chapter ${promptData.chapterNo} of the book "${bookInfo.bookTitle}".
          Genre: "${bookInfo.genre}"
          Target Audience: "${bookInfo.targetAudience}"
          Language: "${bookInfo.language}"
          Please ensure the title is unique and relevant to the chapter's content.
         `;

        const imageTitleResponse =
          await this.textModel.invoke(imageTitlePrompt);
        const imageTitle =
          imageTitleResponse.content?.trim() || `Image ${imageIndex}`;

        const imagePrompt = `
          Create an image titled "${imageTitle}" for Chapter ${promptData.chapterNo} in "${bookInfo.bookTitle}".
          Genre: "${bookInfo.genre}"
          Target Audience: "${bookInfo.targetAudience}"
          Core Idea: "${bookInfo.ideaCore}"
         `;

        const requestData = {
          prompt: imagePrompt, // Adjusted prompt based on cover type
          num_images: 1,
          enable_safety_checker: true,
          safety_tolerance: "2",
          output_format: "jpeg",
          aspect_ratio: "9:16",
          raw: false,
          // Add other fields as required by the API
        };

        const postResponse = await axios.post(
          this.configService.get<string>("BASE_URL_FAL_AI"),
          requestData,
          {
            headers: {
              Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
              "Content-Type": "application/json",
            },
          }
        );

        chapterImages.push({
          title: imageTitle,
          url: postResponse.data.response_url,
        });
      }

      // Construct the prompt
      const chapterPrompt = `
        You are a master book writer. Your task is to write **Chapter ${promptData.chapterNo}** of the book titled **"${bookInfo.bookTitle}"**.
  
        ## 📖 Book Information:
        - **Genre**: ${bookInfo.genre}
        - **Author**: ${bookInfo.authorName || "A knowledgeable expert"}
        - **Core Idea**: ${bookInfo.ideaCore || "A detailed and insightful book on the subject."}
        - **Target Audience**: ${bookInfo.targetAudience || "Professionals, students, and knowledge seekers."}
        - **Language**: The book is written in ${bookInfo.language || "English"}.
  
        ## 🎯 Writing Style:
        Based on the genre **"${bookInfo.genre}"**, adopt an appropriate writing style.
        - Use a **tone** and **structure** that aligns with the genre.
        - Adapt the complexity and depth based on the **target audience**.
  
        ## 📝 Context Memory (Summarized Previous Chapters):
        ${memory}
  
        ## 📖 Chapter Writing Instructions:
        - Begin with a **strong introduction** that aligns with the book's theme.
        - **Your writing must contain between ${promptData.minWords || 5000} and ${promptData.maxWords || 20000} words**.
        - **DO NOT** generate content below the minimum word count.
        - **DO NOT** exceed the maximum word count.
  
        ## 🔍 Additional Guidance:
        ${promptData.additionalInfo || "Follow the established style, tone, and pacing from previous chapters."}
  
        ---
        ## 📝 Previous Chapter Summary:
        ${memory || "No previous summary available."}
  
        **📝 Begin Chapter ${promptData.chapterNo}:**
      `;

      // Stream response using OpenAI API
      const stream = await this.textModel.stream(chapterPrompt);
      let chapterText = "";
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
        chapterText += chunk.content;
        onTextUpdate(chunk.content); // Send real-time updates
      }

      // Ensure chapter text is not empty
      if (!chapterText || chapterText.trim() === "") {
        throw new Error(
          `Chapter ${promptData.chapterNo} content is empty or undefined`
        );
      }
      let chapterImageInfo = [];
      for (let chapterImage of chapterImages) {
      let formattedImage = "";
        // Save the image to the uploads directory
        const savedImagePath = await this.saveGeneratedImage(
          chapterImage.url,
          chapterImage.title
        );
        chapterImageInfo.push({
          url: savedImagePath,
          title: chapterImage.title,
        });
        formattedImage += `### ${chapterImage.title}\n\n`;
        formattedImage += `![${chapterImage.title}](${savedImagePath})\n\n`;

        onTextUpdate(formattedImage);
      }

      // Split text into chunks and insert images dynamically
      const chunkSize = Math.ceil(
        chapterText.length / (chapterImageInfo.length + 1)
      );
      const textChunks = chapterText.match(
        new RegExp(`.{1,${chunkSize}}`, "g")
      ) || ["No content generated."];

      let formattedChapter = "";

      for (let i = 0; i < textChunks.length; i++) {
        formattedChapter += textChunks[i] + "\n\n";

        if (chapterImages[i]) {
          formattedChapter += `### ${chapterImages[i].title}\n\n`;
          formattedChapter += `![${chapterImages[i].title}](${chapterImages[i].url})\n\n`;
        }
      }

      return formattedChapter;
    } catch (error) {
      console.error(
        "Error generating chapter content with streaming and images:",
        error
      );
      throw new Error(error.message);
    }
  }

  async generateChapterOfBook(
    input: BookChapterGenerationDto,
    onTextUpdate: (text: string) => void
  ) {
    try {
      await this.initializeAIModels();

      // Retrieve the book generation info
      const bookInfo = await this.bookGenerationRepository.findOne({
        where: { id: input.bookGenerationId },
      });

      if (!bookInfo) {
        throw new Error("Book generation record not found.");
      }

      // Check if chapter already exists for the given bookGenerationId & chapterNo
      let bookChapter = await this.bookChapterRepository.findOne({
        where: {
          bookGeneration: { id: input.bookGenerationId },
          chapterNo: input.chapterNo,
        },
        relations: ["bookGeneration"], // Ensure related data is loaded
      });

      // Generate new chapter content
      const formattedChapter = await this.ChapterContent(
        input,
        bookInfo,
        onTextUpdate
      );

      if (bookChapter) {
        // If chapter exists, update it
        bookChapter.chapterInfo = formattedChapter;
        bookChapter.maxWords = input.maxWords;
        bookChapter.minWords = input.minWords;
      } else {
        // If chapter does not exist, create a new record
        bookChapter = new BookChapter();
        bookChapter.bookGeneration = bookInfo;
        bookChapter.chapterNo = input.chapterNo;
        bookChapter.chapterInfo = formattedChapter;
        bookChapter.maxWords = input.maxWords;
        bookChapter.minWords = input.minWords;
      }

      // Save (either insert or update)
      const savedChapter = await this.bookChapterRepository.save(bookChapter);
      return savedChapter;
    } catch (error) {
      console.error("Error generating book chapter:", error);
      throw new Error(error.message);
    }
  }

  async getBook(id: number) {
    return await this.bookGenerationRepository.findOne({ where: { id } });
  }
}
