import { ChatOpenAI } from "@langchain/openai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiKey } from "src/api-keys/entities/api-key.entity";
import { Repository } from "typeorm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { BookChapterGenerationDto, BookChapterUpdateDto } from "./dto/book-chapter.dto";
import { BookGeneration, BookType } from "src/book-generation/entities/book-generation.entity";
import { BookChapter } from "./entities/book-chapter.entity";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import axios from "axios";
import { get as levenshtein } from "fast-levenshtein";

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

  private async saveGeneratedImage(
    imageUrl: string,
    bookTitle: string
  ): Promise<string> {
    try {
      if (!imageUrl) {
        throw new Error("Image URL is missing. Cannot save image.");
      }

      const dirPath = path.join(this.uploadsDir, "chapters");
      const baseUrl = this.configService.get<string>("BASE_URL");

      // Fetch the image binary
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      // Generate a unique filename
      const timestamp = Date.now();
      const sanitizedFileName = bookTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fullFileName = `${sanitizedFileName}_chapter_image_${timestamp}.png`;
      const imagePath = path.join(dirPath, fullFileName);

      // Ensure directory exists
      fs.mkdirSync(dirPath, { recursive: true });

      // Save image
      fs.writeFileSync(imagePath, imageResponse.data);

      return `${baseUrl}/uploads/chapters/${fullFileName}`;
    } catch (error) {
      console.error(`Error saving chapter image: ${error.message}`);
      throw new Error(`Failed to save image: ${error.message}`);
    }
  }

  private insertImagesIntoChapter(
    chapterText: string,
    keyPoints: string[],
    chapterImages: { title: string; url: string | null }[]
  ): string {
    let formattedChapter = "";
    let chapterTextParts = chapterText.split("\n");

    // Step 1: Match key points with actual text
    const matchedKeyPoints = this.matchKeyPointsWithText(
      chapterText,
      keyPoints
    );

    console.log("🔍 Matched Key Points:", matchedKeyPoints);
    console.log("🖼️ Chapter Images:", chapterImages);

    for (let i = 0; i < chapterTextParts.length; i++) {
      formattedChapter += chapterTextParts[i] + "\n\n";

      // Find the best-matching key point in the text
      const imageIndex = matchedKeyPoints.findIndex(
        (key) =>
          chapterTextParts[i].toLowerCase().includes(key.toLowerCase().trim()) // Case-insensitive match
      );

      if (imageIndex !== -1 && chapterImages[imageIndex]?.url) {
        console.log(
          `✅ Inserting image for key point: "${chapterImages[imageIndex].title}"`
        );
        formattedChapter += `### ${chapterImages[imageIndex].title}\n\n`;
        formattedChapter += `![${chapterImages[imageIndex].title}](${chapterImages[imageIndex].url})\n\n`;
      }
    }

    return formattedChapter;
  }

  private matchKeyPointsWithText = (
    chapterText: string,
    keyPoints: string[]
  ): string[] => {
    const chapterSentences = chapterText
      .split(/[.?!]\s+/)
      .map((s) => s.trim())
      .filter((s) => s);

    return keyPoints.map((keyPoint) => {
      let bestMatch = chapterSentences[0];
      let lowestDistance = Infinity;

      for (const sentence of chapterSentences) {
        const distance = levenshtein(keyPoint, sentence);
        if (distance < lowestDistance) {
          lowestDistance = distance;
          bestMatch = sentence;
        }
      }

      return bestMatch;
    });
  };

  private async pollImageGeneration(
    responseUrl: string,
    bookTitle: string,
    keyPoint: string,
    index: number,
    chapterImages: { title: string; url: string | null }[]
  ): Promise<void> {
    const maxRetries = 12; // Retry for up to 2 minutes
    const delayMs = 10000; // Wait 10 seconds per retry

    let attempt = 0;
    let imageUrl: string | null = null;

    while (attempt < maxRetries) {
      try {
        const getResponse = await axios.get(responseUrl, {
          headers: {
            Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
            "Content-Type": "application/json",
          },
        });

        if (getResponse.data.images?.length > 0) {
          imageUrl = getResponse.data.images[0].url;
          break;
        }
      } catch (error) {
        console.warn(`Image not ready (Attempt ${attempt + 1}/${maxRetries})`);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs)); // Wait before retrying
      attempt++;
    }

    if (!imageUrl) {
      console.error(
        `Image generation failed for key point: "${keyPoint}" at index ${index}.`
      );
      return;
    }

    // Save the image once it's ready
    const savedImagePath = await this.saveGeneratedImage(imageUrl, bookTitle);

    if (savedImagePath) {
      // Explicitly update the array
      chapterImages[index] = { ...chapterImages[index], url: savedImagePath };
      console.log(
        `✅ Image saved successfully for key point "${keyPoint}": ${savedImagePath}`
      );
    } else {
      console.error(`❌ Failed to save image for key point "${keyPoint}"`);
    }
  }


  private async ChapterContent(
    promptData: BookChapterGenerationDto,
    bookInfo: BookGeneration,
    onTextUpdate: (text: string) => void
  ): Promise<string> {
    try {
      const memory = new ConversationSummaryBufferMemory({
        llm: this.textModel,
        memoryKey: "chapter_summary",
        returnMessages: true,
      });
let updatePrompt
      if (promptData.selectedText) {
if(promptData.instruction){
   updatePrompt = `
  You are an expert book writer. Improve the following paragraph of the book "${bookInfo.bookTitle}" while maintaining its context and coherence:
 
 **Original Paragraph:**
 "${promptData.selectedText}"
 **Instructions:**
 "${promptData.instruction}"
 **Guidelines:**
 - Enhance the clarity and flow.
 - Maintain the same context and meaning.
 - Avoid generating completely new or irrelevant content.
 - Keep it engaging and refined.

 **Improved Paragraph (do not enclose in quotes):**
 `;
 const memoryVariables = await memory.loadMemoryVariables({}); // Retrieve memory variables using loadMemoryVariables
 if (memoryVariables?.history) {
   updatePrompt += `
   **Previous Chapter Context:**
   ${memoryVariables.history}
   `;
 }
}
        else{ updatePrompt = `
       You are an expert book writer. Improve the following paragraph of the book "${bookInfo.bookTitle}" while maintaining its context and coherence:
      
      **Original Paragraph:**
      "${promptData.selectedText}"

      **Guidelines:**
      - Enhance the clarity and flow.
      - Maintain the same context and meaning.
      - Avoid generating completely new or irrelevant content.
      - Keep it engaging and refined.

      **Improved Paragraph (do not enclose in quotes):**
      `;}
    
      let updateResponse = await this.textModel.stream(updatePrompt);
      let updatedText = "";
      
      for await (const chunk of updateResponse) {
        updatedText += chunk.content;
        onTextUpdate(chunk.content);
      }
    
      await memory.saveContext({ input: promptData.selectedText }, { output: updatedText });
    
    return updatedText;
      }
       else {
      // Step 1: Generate the Chapter Text
      const chapterPrompt = `
           You are a professional author tasked with writing **Chapter ${promptData.chapterNo}: "${promptData.chapterName}"** of the book titled **"${bookInfo.bookTitle}"**.

            ## 📖 Book Information:
            - **Genre**: ${bookInfo.genre}
            - **Author**: ${bookInfo.authorName || "A knowledgeable expert"}
            - **Core Idea**: ${bookInfo.ideaCore || "A detailed and insightful book on the subject."}
            - **Target Audience**: ${bookInfo.targetAudience || "Professionals, students, and knowledge seekers."}
            - **Language**: The book is written in ${bookInfo.language || "English"}.
      
            ## 🎯 Writing Style:
            - Clearly structure the content using Markdown:
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

      const stream = await this.textModel.stream(chapterPrompt);
      let chapterText = "";
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
        chapterText += chunk.content;
        onTextUpdate(chunk.content);
      }

      if (!chapterText.trim()) {
        throw new Error(`Chapter ${promptData.chapterNo} content is empty.`);
      }
    

      if (promptData.noOfImages === 0) {
        console.log("⚡ No images required. Returning chapter without images.");
        await memory.saveContext({ input: `Start of Chapter ${promptData.chapterNo}` }, { output: chapterText });
        return chapterText;
      }
      
      // Step 2: Extract Key Points
      const keyPointPrompt = `
  Extract exactly ${promptData.noOfImages} key points directly from the following chapter text.
  Each key point must be an exact phrase or sentence from the text and should highlight an important concept or event.
  Do not rephrase, summarize, or add new information.

  Chapter Text:
  ${chapterText}
`;

      const keyPointResponse = await this.textModel.invoke(keyPointPrompt);
      const keyPoints = keyPointResponse.content
        ?.split("\n")
        .filter((point) => point.trim() !== "");

      if (!keyPoints || keyPoints.length !== promptData.noOfImages) {
        throw new Error(
          `Failed to extract exactly ${promptData.noOfImages} key points.`
        );
      }

      const chapterImages: { title: string; url: string | null }[] =
        keyPoints.map((keyPoint) => ({ title: keyPoint, url: null }));

      // Step 3: Trigger Image Generation in Background
      const imageRequests = keyPoints.map(async (keyPoint, index) => {
        const imagePrompt = `
        Create a high-quality illustration for:
        - **Chapter Number**: ${promptData.chapterNo}
        - **Book Title**: "${bookInfo.bookTitle}"
        - **Key Theme / Focus**: "${keyPoint}"
        - **Genre**: "${bookInfo.genre}"
        - **Target Audience**: "${bookInfo.targetAudience}"
        - **Core Concept**: "${bookInfo.ideaCore}"
      
        The illustration should visually capture the essence of the key point, aligning with the book's theme, tone, and intended audience. Ensure the style matches the genre, making it compelling and engaging.
      `;

        const requestData = { prompt: imagePrompt };
        try {
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

          const imageResponseUrl = postResponse.data.response_url;

          // Ensure pollImageGeneration is awaited
          await this.pollImageGeneration(
            imageResponseUrl,
            bookInfo.bookTitle,
            keyPoint,
            index,
            chapterImages
          );
        } catch (error) {
          console.error(
            `Error triggering image generation for key point: "${keyPoint}"`,
            error
          );
        }
      });

      // Wait for all image requests to complete before proceeding
      await Promise.all(imageRequests);


      // Step 4: Return Chapter Text Immediately
      const formattedChapter = this.insertImagesIntoChapter(
        chapterText,
        keyPoints,
        chapterImages
      );
      await memory.saveContext({ input: `Start of Chapter ${promptData.chapterNo}` }, { output: chapterText });

      return formattedChapter;
    }
    } catch (error) {
      console.error("Error generating chapter content:", error);
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
      if (input.selectedText && input.instruction) {return formattedChapter}

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
if(bookInfo.numberOfChapters===input.chapterNo){
  const updatedBookGeneration = {
    ...bookChapter.bookGeneration,
    type: BookType.COMPLETE
  };
  
   await this.bookGenerationRepository.update(
    { id: bookChapter.bookGeneration.id }, // Search condition
    updatedBookGeneration                   // Fields to update
  );
}
      // Save (either insert or update)
      const savedChapter = await this.bookChapterRepository.save(bookChapter);
      return savedChapter;
    } catch (error) {
      console.error("Error generating book chapter:", error);
      throw new Error(error.message);
    }
  }
  async updateChapter(
    input: BookChapterUpdateDto,
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
      bookChapter.chapterInfo=input.updateContent
      const updateChapter = await this.bookChapterRepository.save(bookChapter);
      return updateChapter;
    } catch (error) {
      console.error("Error generating book chapter:", error);
      throw new Error(error.message);
    }
  }

  async getBook(id: number) {
    return await this.bookGenerationRepository.findOne({ where: { id } });
  }
}
