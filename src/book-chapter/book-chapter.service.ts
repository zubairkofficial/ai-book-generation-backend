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

@Injectable()
export class BookChapterService {
  private textModel;

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
      const apiKeyRecord: any = await this.apiKeyRepository.find();
      if (!apiKeyRecord) {
        throw new Error("No API keys found in the database.");
      }

      this.textModel = new ChatOpenAI({
        openAIApiKey: apiKeyRecord[0].openai_key,
        temperature: 0.4,
        modelName: apiKeyRecord[0].model,
      });

      this.openai = new OpenAI({
        apiKey: apiKeyRecord[0].dalle_key,
      });

      this.logger.log(
        `AI Models initialized successfully with model: ${apiKeyRecord[0].model}`
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

  
  private async ChapterContent(
    promptData: BookChapterGenerationDto,
    bookInfo: BookGeneration,
    onTextUpdate: { (text: string): void; (arg0: string): void; }
  ): Promise<string> {
    try {
      const chapterPrompt = `
            You are a master storyteller and novelist. Your task is to write **Chapter ${promptData.chapterNo}** of the book titled **"${bookInfo.bookTitle}".
            
            ## 📖 Book Information:
            - **Genre**: ${bookInfo.genre}
            - **Author**: ${bookInfo.authorName || "An esteemed writer"}
            - **Core Idea**: ${bookInfo.ideaCore || "A captivating tale filled with mystery and adventure."}
            - **Author Bio**: ${bookInfo.authorBio || "A well-renowned storyteller with a knack for deep narratives."}
            - **Target Audience**: ${bookInfo.targetAudience || "Readers who enjoy immersive storytelling and suspenseful plots."}
            - **Language**: The book is written in ${bookInfo.language || "English"}.
            
            ## 🖊️ Chapter Writing Instructions:
            - Begin with a **chapter title** that encapsulates the essence of the chapter.
            - Develop **${bookInfo.characters || "dynamic"}** characters with depth, unique personalities, and compelling motivations.
            - Use **rich descriptions** to create immersive settings and build atmosphere.
            - Your writing must contain at least **${promptData.minWords || 500} words** .
            - The maximum word limit should not exceed **${promptData.maxWords || 2000} words**.
            - If necessary, **expand descriptions, add internal monologues, deepen character interactions, or enhance world-building** to meet the required length.
            - **Do not abruptly end the chapter**—continue writing naturally until a satisfying point is reached.
            
            ## 🔍 Additional Guidance:
            ${promptData.additionalInfo || "Follow the established style, tone, and pacing from previous chapters."}
            
            ---
            
            **📝 Begin Chapter ${promptData.chapterNo}:**
            `;

      let chapterText = "";
      chapterText = await this.invokeWithSimulatedStreaming.call(
        this,
        chapterPrompt,
        (token: string) => {
          process.stdout.write(token);
          chapterText += token;
          onTextUpdate(token);
        }
      );

      if (!chapterText || chapterText.trim() === "") {
        throw new Error(
          `Chapter ${promptData.chapterNo} content is empty or undefined`
        );
      }
      const baseUrl = this.configService.get<string>("BASE_URL");

      const imageCount = Math.floor(Math.random() * 2) + 2;
      const totalImages = Math.min(+promptData.noOfImages, imageCount);
      const chapterImages: { title: string; url: string }[] = [];
      for (let imageIndex = 1; imageIndex <= totalImages; imageIndex++) {
        let formattedImage = ``; // Include chapter title at the beginning

        const imageTitlePrompt = `
              Provide a short but descriptive title for an illustration in Chapter ${promptData.chapterNo} of the book "${bookInfo.bookTitle}".
              Genre: "${bookInfo.genre}"
             Target Audience: "${bookInfo.targetAudience}"
              Language: "${bookInfo.language}"
              Please ensure the title is unique and relevant to the chapter's content.
           ## Illustration Guidance:
  ${promptData.imagePrompt || "Illustrate a key scene from the chapter with vivid imagery, capturing the essence of the story."}
              `;

        const imageTitleResponse =
          await this.textModel.invoke(imageTitlePrompt);
        const imageTitle =
          imageTitleResponse.content?.trim() || `Image ${imageIndex}`;
        const imagePrompt = `
  Create an illustration titled "${imageTitle}" for Chapter ${promptData.chapterNo} in "${bookInfo.bookTitle}".
  Genre: "${bookInfo.genre}"
  Target Audience: "${bookInfo.targetAudience}"

  ## Illustration Guidance:
  ${promptData.imagePrompt || "Illustrate a key scene from the chapter with vivid imagery, capturing the essence of the story."}
`;

        const imageResponse = await this.openai.images.generate({
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        });
        if (imageResponse.data?.[0]?.b64_json) {
          const savedImagePath = await this.saveImage(
            `data:image/png;base64,${imageResponse.data[0].b64_json}`,
            `${bookInfo.bookTitle}_chapter_${promptData.chapterNo}_image_${imageIndex}`,
            "chapters"
          );
          chapterImages.push({ title: imageTitle, url: savedImagePath });

          formattedImage += `${imageTitle}\n\n`;

          formattedImage += `![${imageTitle}](${baseUrl}/uploads/${savedImagePath})\n\n`;

          onTextUpdate(formattedImage);
        } else {
          this.logger.warn(
            `Image ${imageIndex} for Chapter ${promptData.chapterNo} was not generated.`
          );
        }
      }

      const chunkSize = Math.ceil(
        chapterText.length / (chapterImages.length + 1)
      );
      const textChunks = chapterText.match(
        new RegExp(`.{1,${chunkSize}}`, "g")
      ) || ["No content generated."];

      let formattedChapter = ``; // Include chapter title at the beginning

      for (let i = 0; i < chapterImages.length; i++) {
        formattedChapter += `${textChunks[i] || ""}\n\n`;
        formattedChapter += `${chapterImages[i].title}\n\n`;
        formattedChapter += `![${chapterImages[i].title}](${baseUrl}/uploads/${chapterImages[i].url})\n\n`;
      }
      formattedChapter += textChunks[chapterImages.length] || ""; // Add the remaining text

      return formattedChapter;
    } catch (error) {
      console.error("Error generating chapter content with images:", error);
      throw new Error("Failed to generate chapter content with images");
    }
  }

  async generateChapterOfBook(
    input: BookChapterGenerationDto,
    onTextUpdate: (text: string) => void
  ) {
    try{
    await this.initializeAIModels();
    const bookInfo = await this.bookGenerationRepository.findOne({
      where: { id: input.bookGenerationId },
    });
    const chapters = await this.ChapterContent(input, bookInfo, onTextUpdate);
    const bookChapter = new BookChapter();
    bookChapter.bookGeneration = bookInfo;
    bookChapter.maxWords = input.maxWords;
    bookChapter.minWords = input.minWords;
    bookChapter.chapterNo = input.chapterNo;
    bookChapter.chapterInfo = chapters;
    const savedMetadataBook =
      await this.bookChapterRepository.save(bookChapter);
    return savedMetadataBook;
  }
    catch (error) {
      console.error('Error generating book chapter:', error);
      throw new Error(error.message);
    }
  }
  async getBook(id: number) {
    return await this.bookGenerationRepository.findOne({ where: { id } });
  }
}
