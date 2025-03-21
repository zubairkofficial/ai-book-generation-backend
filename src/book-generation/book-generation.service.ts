import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChatOpenAI } from "@langchain/openai"; // For text generation
import { ConfigService } from "@nestjs/config";
import { BookGeneration, BookType } from "./entities/book-generation.entity";
import OpenAI from "openai"; // For DALL·E image generation
import * as fs from "fs";
import * as path from "path";
import { ApiKey } from "src/api-keys/entities/api-key.entity";

import {
  BookGenerationDto,
  BRGDTO,
  RegenerateImage,
  SearchDto,
  UpdateBookCoverDto,
  UpdateBookDto,
  UpdateDto,
} from "./dto/book-generation.dto";
import { UserDto } from "src/auth/types/request-with-user.interface";
import axios from "axios";
import { UserInterface } from "src/users/dto/users.dto";
import { UsersService } from "src/users/users.service";
import { ContentType } from "src/utils/roles.enum";
import { BookChapter } from "src/book-chapter/entities/book-chapter.entity";
import { SettingsService } from "src/settings/settings.service";

@Injectable()
export class BookGenerationService {
  private settingPrompt;
  private textModel;
  private apiKeyRecord;
  private openai: OpenAI;
  private readonly logger = new Logger(BookGenerationService.name);
  private readonly uploadsDir: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    private readonly userService: UsersService,
    private readonly settingsService: SettingsService
  ) {
    this.uploadsDir = this.setupUploadsDirectory();
  }
  private async initializeAIModels() {
    try {
      this.apiKeyRecord = await this.apiKeyRepository.find();
      if (!this.apiKeyRecord) {
        throw new Error("No API keys found in the database.");
      }
      this.settingPrompt=await this.settingsService.getAllSettings()
      if (!this.settingPrompt) {
        throw new Error("No setting prompt  found in the database.");
      }
      this.textModel = new ChatOpenAI({
        openAIApiKey: this.apiKeyRecord[0].openai_key,
        temperature: 0.4,
        modelName: this.apiKeyRecord[0].model,
      });

     

      this.logger.log(
        `AI Models initialized successfully with model: ${this.apiKeyRecord[0].model}`
      );
    } catch (error) {
      this.logger.error(`Failed to initialize AI models: ${error.message}`);
      throw new Error("Failed to initialize AI models.");
    }
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

  private async generateBookImage(responseUrl, promptData): Promise<string> {
    try {
      const maxRetries = 12;
      const delayMs = 10000; // 10 seconds between retries

      let imageUrl: string | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          this.logger.warn(
            `⏳ Image not ready (Attempt ${attempt}/${maxRetries})`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs)); // Wait before retrying
      }

      if (!imageUrl)
        throw new Error("❌ Image generation failed after retries.");

      // Download & Save Image
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const sanitizedFileName = promptData.bookTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fullFileName = `${sanitizedFileName}_${Date.now()}.png`;
      const imagePath = path.join(this.uploadsDir, "covers", fullFileName);

      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
      fs.writeFileSync(imagePath, imageResponse.data);

      return `covers/${fullFileName}`;
    } catch (error) {
      this.logger.error(`❌ Error downloading book image: ${error.message}`);
      throw new Error(error.message);
    }
  }

  private async regenerateBookCover(
    promptData: BookGenerationDto,
    coverType: "front" | "back"
  ): Promise<string> {
    try {
      const maxRetries = 5;
      const delayMs = 3000;

      let coverPrompt =
        coverType === "front"
        ? `Design a visually striking and professional front cover for "${promptData.bookTitle}"
        - **Core Idea**:${promptData.bookInformation}
        - **Target Audience**:${promptData.targetAudience}
        - **Language**:${promptData.language}
        - **System Prompt**:${this.settingPrompt.coverImagePrompt}
        - Show Front cover image (no show back cover image)
        `
         : `Generate a professional back cover for "${promptData.bookTitle}".`;

      if (promptData.bookInformation) {
        coverPrompt += ` The book explores the following theme: ${promptData.bookInformation}.`;
      }
      if (promptData.additionalContent) {
        coverPrompt += ` Additional notes for the cover: ${promptData.additionalContent}.`;
      }

      const imageParameters = {
        prompt: coverPrompt,
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: "2",
        output_format: "jpeg",
        aspect_ratio: "9:16",
        raw: false,
      };

      let responseUrl: string | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const postResponse = await axios.post(
            this.settingPrompt.coverImageDomainUrl ??  this.configService.get<string>("BASE_URL_FAL_AI"),
            imageParameters,
            {
              headers: {
                Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (postResponse.data && postResponse.data.response_url) {
            responseUrl = postResponse.data.response_url;
            break;
          } else {
            this.logger.warn(
              `⚠️ No response URL in API response. Attempt ${attempt}`
            );
          }
        } catch (error) {
          if (error.response) {
            this.logger.warn(
              `⚠️ API error (Attempt ${attempt}): ${JSON.stringify(error.response.data)}`
            );
          } else {
            this.logger.warn(
              `⚠️ Request failed (Attempt ${attempt}): ${error.message}`
            );
          }

          if (attempt < maxRetries)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!responseUrl)
        throw new Error("❌ Failed to generate book cover after retries.");
      return responseUrl;
    } catch (error) {
      this.logger.error(`❌ Error generating book cover: ${error.message}`);
      throw new Error(error.message);
    }
  }

  private async generateBookCover(
    promptData: BookGenerationDto,
    
  ): Promise<string> {
    try {
      const maxRetries = 5; // Retry up to 5 times
      const delayMs = 3000; // Wait 3 seconds between retries

      const coverPrompt = `Design a visually striking and professional front cover for "${promptData.bookTitle}"
          - **Core Idea**:${promptData.bookInformation || "Subtle business-related icons for a sleek finish"}
          - **Target Audience**:${promptData.targetAudience || "General"}
          - **Language**:${promptData.language || "All Ages"}
          - **System Prompt**:${this.settingPrompt.coverImagePrompt}
          `

      const requestData = {
        prompt: coverPrompt,
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: "2",
        output_format: "jpeg",
        aspect_ratio: "9:16",
        raw: false,
      };

      let responseUrl: string | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const postResponse = await axios.post(
            this.settingPrompt.coverImageDomainUrl ??  this.configService.get<string>("BASE_URL_FAL_AI"),
            requestData,
            {
              headers: {
                Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
                "Content-Type": "application/json",
              },
            }
          );

          responseUrl = postResponse.data.response_url;
          if (responseUrl) break; // ✅ Stop retrying if successful
        } catch (error) {
          this.logger.warn(
            `⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`
          );
          if (attempt < maxRetries)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!responseUrl)
        throw new Error("❌ Failed to generate book cover after retries.");

      return responseUrl;
    } catch (error) {
      this.logger.error(`❌ Error generating book cover: ${error.message}`);
      throw new Error(error.message);
    }
  }



  private async introductionContent(promptData: BookGenerationDto) {
    try {
      this.logger.log(
        `📖 Generating Introduction Content for: "${promptData.bookTitle}"`
      );

      // Prepare all prompts (UNCHANGED)
      const coverPagePrompt = `
      Create a professional book Cover Page with the following details:
      - Title: "${promptData.bookTitle}"
      - Author: "${promptData.authorName || "Anonymous"}"
      - Publisher: ${promptData.authorName || "AiBookPublisher"}
      - AuthorBio: ${promptData.authorBio || "Writer"}
      - Language: ${promptData.language || "English"}
      - CoreIdea: ${promptData.bookInformation}
    `;

      const dedicationPrompt = `
    Write a heartfelt and meaningful dedication for the book titled "${promptData.bookTitle}". 
    Consider the book's central  core idea: "${promptData.bookInformation || "Not specified"}".
    The dedication should be general enough to resonate with a wide audience but still feel personal and authentic. 
    It can express gratitude or motivation, depending on the tone of the book ${promptData.authorName} && ${promptData.authorBio}.
  `;

      const prefacePrompt = `
    Create a preface for the book titled "${promptData.bookTitle}".
    
    Structure the preface with exactly these four sections using markdown headings:
    
    ## Core Idea
    Clearly explain the main concept of the book and its purpose.
    
    ## Why It Matters
    Describe why this topic is important, relevant, and timely for readers.
    
    ## What to Expect
    Outline what readers will gain from the book and how it's structured.
    
    ## Acknowledgments
    Thank those who contributed to or supported the creation of the book.
    
    Book details:
    - Title: "${promptData.bookTitle}"
    - Language: ${promptData.language || "English"}
    - Core Idea: ${promptData.bookInformation}
    
    Important: Format each section title exactly as shown above, with '##' preceding each heading.
    Keep the preface concise, engaging, and professional while maintaining these exact section headings.
  `;

      const introductionPrompt = `
      Write an introduction for the book "${promptData.bookTitle}".
      
      
      Book details:
      - Title: "${promptData.bookTitle}"
      - Core Idea: ${promptData.bookInformation}
      
      Write only the introduction text, with no additional formatting or styling.
    `;

      const tableOfContentsPrompt = `
        Create a list of unique, engaging chapter titles for a book with ${promptData.numberOfChapters} chapters.
        Each title should reflect the theme of the book and evoke curiosity.
        The titles should be concise, descriptive, and hint at the main events or ideas in each chapter.
  
        - Title: "${promptData.bookTitle}"
        - Language: ${promptData.language || "English"}
        - CoreIdea: ${promptData.bookInformation}
        - Number of Chapters: ${promptData.numberOfChapters}
  
        ## Output Format (STRICTLY FOLLOW THIS FORMAT):
        Chapter 1: [Title]
        Chapter 2: [Title]
        Chapter 3: [Title]
        ...
        Chapter ${promptData.numberOfChapters}: [Title]
  
        Continue for all chapters, ensuring each title is creative and fitting for the respective chapter's content.
      `;

      // **Run all AI calls in parallel** (Faster Execution)
      const [
        coverPageResponse,
        dedication,
        preface,
        introduction,
        tableOfContentsResponse,
      ] = await Promise.all([
        this.textModel.invoke(coverPagePrompt),
        this.textModel.invoke(dedicationPrompt),
        this.textModel.invoke(prefacePrompt),
        this.textModel.invoke(introductionPrompt),
        this.textModel.invoke(tableOfContentsPrompt),
      ]);

      return {
        coverPageResponse: coverPageResponse.content,
        dedication: dedication.content,
        preface: preface.content,
        introduction: introduction.content,
        tableOfContents: tableOfContentsResponse.content,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error generating introduction content: ${error.message}`
      );
      throw new Error(error.message);
    }
  }





 

  private async createBookContent(promptData: BookGenerationDto) {
    try {
      // Run introduction & end-of-book content generation **in parallel**
      const [introContent] = await Promise.all([
        this.introductionContent(promptData),
        // this.endOfBookContent(promptData),
      ]);

      return {
        ...introContent,
        // ...endOfBookContent,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating book content: ${error.message}`);
      throw new Error(error.message);
    }
  }

  async getAllBooksByUser(user: UserDto): Promise<BookGeneration[]> {
    const query = this.bookGenerationRepository
      .createQueryBuilder("bookGeneration")
      .leftJoinAndSelect("bookGeneration.bookChapter", "bookChapter")
      .orderBy("bookGeneration.createdAt", "DESC")
      .addOrderBy("bookChapter.createdAt", "ASC");

    if (user.role !== "admin") {
      query.where("bookGeneration.userId = :userId", { userId: user.id });
    }

    return await query.getMany();
  }

  async getBook(id: number) {
    try {
      return this.bookGenerationRepository.findOne({ where: { id } });
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async getAllBooksCount(userId: number | null) {
    if (userId)
      return await this.bookGenerationRepository.count({
        where: { user: { id: userId } },
      });
    else return await this.bookGenerationRepository.count();
  }

  async generateAndSaveBook(
    userId: number,
    promptData: BookGenerationDto
  ): Promise<BookGeneration> {
    try {
      await this.initializeAIModels(); // Ensure API keys are loaded before generating content

      const user=await this.userService.getProfile(userId)
      if(!user){
        throw new NotFoundException('user not exist')
      }
      // **Run AI Content & Image Generation in Parallel**
      const [bookContentResult, coverImageResult] = await Promise.allSettled([
        this.createBookContent(promptData), // Generate book content
        this.generateBookCover(promptData), // Generate front cover (URL)
      ]);

      // **Extract book content**
      if (bookContentResult.status !== "fulfilled") {
        throw new Error(
          `❌ Book content generation failed: ${bookContentResult.reason}`
        );
      }
      const {
        coverPageResponse,
        dedication,
        preface,
        introduction,
        tableOfContents,
      } = bookContentResult.value;

      // **Immediately save book metadata (Images still downloading)**
      const book = new BookGeneration();
      book.user = user;
      book.bookTitle = promptData.bookTitle;
      book.authorName = promptData.authorName;
      book.authorBio = promptData.authorBio;
      book.genre = promptData.genre;
      book.ideaCore = promptData.bookInformation;
      book.characters = promptData.characters;
      book.numberOfChapters = promptData.numberOfChapters;
      book.targetAudience = promptData.targetAudience;
      book.language = promptData.language;
      book.additionalContent = promptData.additionalContent;
      book.additionalData = {
        coverImageUrl: null, // To be updated when image is ready
        coverPageResponse: coverPageResponse,
        dedication: dedication,
        preface: preface,
        introduction: introduction,
        tableOfContents: tableOfContents,
      };

      // **Save book immediately**
      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(
        `📖 Book saved successfully for user ${userId}: ${promptData.bookTitle}`
      );

      // **Download & Save Images in Background (Non-blocking)**
      const imageDownloadTasks: Promise<void>[] = [];

      if (coverImageResult.status === "fulfilled") {
        imageDownloadTasks.push(
          this.generateBookImage(coverImageResult.value, promptData)
            .then(async (coverImagePath) => {
              // Retrieve the current book record to get `additionalData`
              const book = await this.bookGenerationRepository.findOne({
                where: { id: savedBook.id },
              });
              if (!book) return;

              // Update `additionalData`
              book.additionalData = {
                ...book.additionalData,
                coverImageUrl: coverImagePath,
              };

              // Save the updated record
              await this.bookGenerationRepository.update(savedBook.id, {
                additionalData: book.additionalData,
              });
            })
            .catch((error) =>
              this.logger.error(
                `❌ Failed to save front cover: ${error.message}`
              )
            )
        );

      
      }

      // **Process Image Downloads in Background**
      Promise.allSettled(imageDownloadTasks).then(() => {
        this.logger.log(`✅ Cover images updated for book ${savedBook.id}`);
      });

      return savedBook;
    } catch (error) {
      this.logger.error(
        `❌ Error generating and saving book: ${error.message}`
      );
      throw new Error(error.message);
    }
  }
  async updateBookGenerate(
    userId: number,
    input: UpdateBookDto
  ): Promise<BookGeneration> {
    try {
      const book = await this.getBookById(input.bookGenerationId);
      if(!book){
        throw new NotFoundException('book not exist')
      }
      const user=await this.userService.getProfile(userId)
      if(!user){
        throw new NotFoundException('user not exist')
      }
     
      // **Immediately save book metadata (Images still downloading)**
      book.user = user;
      book.additionalData = {
        coverPageResponse:
          input.coverPageResponse ?? book.additionalData.coverPageResponse,
        dedication: input.dedication ?? book.additionalData.dedication,
        preface: input.preface ?? book.additionalData.preface,
        introduction: input.introduction ?? book.additionalData.introduction,

        coverImageUrl: book.additionalData.coverImageUrl,
        tableOfContents:
          input.tableOfContents ?? book.additionalData.tableOfContents,
        backCoverImageUrl: book.additionalData.backCoverImageUrl,
      };
      if (input.references) book.references = input.references;
      if (input.index) book.index = input.index;
      if (input.glossary) book.glossary = input.glossary;

      return this.bookGenerationRepository.save(book);
    } catch (error) {
      this.logger.error(
        `❌ Error generating and saving book: ${error.message}`
      );
      throw new Error(error.message);
    }
  }

  async getBookById(id: number) {
    try {
      // Perform a left join with the BookChapter table
      const book = await this.bookGenerationRepository.findOne({
        where: { id },
        relations: ["bookChapter"], // This ensures the BookChapter is included in the result
      });

      return book; // Return the book with chapters
    } catch (error) {
      throw new Error(error.message); // Handle any errors that occur
    }
  }
 
  async generateBookEndContent(
    input: BRGDTO,
    onTextUpdate: (text: string) => void,
    user: UserInterface
  ): Promise<BookGeneration> {
    await this.initializeAIModels(); // Ensure API keys are loaded before generating content

    // 1. Get book with chapters
    const book = await this.bookGenerationRepository.findOne({
      where: { id: input.bookId },
      relations: ['bookChapter']
    });
  
    if (!book) {
      throw new NotFoundException(`Book with ID ${input.bookId} not found`);
    }
  
   
    // 3. Validate chapters exist
    if (!book.bookChapter || book.bookChapter.length === 0) {
      throw new BadRequestException('Book has no chapters to analyze');
    }
  
    // 4. Extract chapter content
    const chaptersContent = book.bookChapter
      .map((chap:BookChapter) => chap.chapterInfo)
      .join('\n\n');
  
    // 5. Generate appropriate content
    let generatedContent: string;
    const prompt = this.getContentPrompt(input, chaptersContent);
  
    try {
      const aiResponse = await this.textModel.stream(prompt);
      let finalSummary = "";
      for await (const chunk of aiResponse) {
        finalSummary += chunk.content;
        onTextUpdate(chunk.content);
      }

      generatedContent = finalSummary;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  
    // 6. Update and save book
    switch (input.contentType) {
      case ContentType.GLOSSARY:
        book.glossary = generatedContent;
        break;
      case ContentType.INDEX:
        book.index = generatedContent;
        break;
      case ContentType.REFERENCE:
        book.references = generatedContent;
        break;
    }
    if(book.index&&book.references&&book.glossary) book.type=BookType.COMPLETE
    
    return this.bookGenerationRepository.save(book);
  }
  
  private getContentPrompt(
    input: BRGDTO,
    chaptersContent: string,
  ): string {
    if (input.currentContent) {
      return `
        You are an expert book writer. Improve the following paragraph of the book provided content type:
        Content Type :${input.contentType}
        Current Content: ${input.currentContent}
        Additional instructions: ${input.additionalInfo}
        **Guidelines:**
            - Enhance the clarity and flow.
            - Maintain the same context and meaning.
            - Avoid generating completely new or irrelevant content.
            - Keep it engaging and refined.
      
      `;
    }
    const basePrompts = {
      [ContentType.GLOSSARY]: `
        Generate a comprehensive glossary based on these chapters. Follow these rules:
        - List terms alphabetically
        - Include chapter numbers where terms appear
        - Provide clear definitions
        - Format: "Term (Chapter X): Definition"
        Additional instructions: ${input.additionalInfo}
        Chapters content: ${chaptersContent}
      `,
  
      [ContentType.INDEX]: `
        Create a detailed book index. Requirements:
        - List topics and subtopics
        - Include imaginary page numbers (start each chapter on new page)
        - Use standard index formatting
        Additional instructions: ${input.additionalInfo}
        Chapters content: ${chaptersContent}
      `,
  
      [ContentType.REFERENCE]: `
        Generate references in APA format. Guidelines:
        - Include both real and book-specific citations
        - Format authors properly
        - Add publication years
        Additional instructions: ${input.additionalInfo}
        Chapters content: ${chaptersContent}
      `
    };
  
    
    return basePrompts[input.contentType];
  }

  async updateBookImage(
    input: UpdateDto
  ): Promise<{ message: string; imagePath: string }> {
    const book = await this.bookGenerationRepository.findOne({
      where: { id: input.bookId },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${input.bookId} not found`);
    }

    // Define image storage path
    const uploadsDir = path.join(__dirname, "..", "..", "uploads/covers");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileName = `${input.bookId}_${input.imageType}${path.extname(book.bookTitle)}`;
    const relativePath = `/covers/${fileName}`; // This will be stored in DB
    const absolutePath = path.join(uploadsDir, fileName);

    const bufferData = Buffer.from(input.image.buffer);

    // Save file to disk
    fs.writeFileSync(absolutePath, bufferData);

    // Update only with relative path
    if (!book.additionalData) {
      book.additionalData = {}; // Ensure additionalData exists
    }

    if (input.imageType === "cover") {
      book.additionalData.coverImageUrl = relativePath;
    } else {
      book.additionalData.backCoverImageUrl = relativePath;
    }

    await this.bookGenerationRepository.save(book);

    return {
      message: "Book image updated successfully",
      imagePath: relativePath,
    };
  }
  async updateBookGenerateCover(user, input: UpdateBookCoverDto) {
    const book = await this.bookGenerationRepository.findOne({
      where: { id: input.bookGenerationId },
    });

    if (!book) {
      throw new NotFoundException(
        `Book with ID ${input.bookGenerationId} not found`
      );
    }

    if (input.authorName) book.authorName = input.authorName;
    if (input.bookTitle) book.bookTitle = input.bookTitle;
    if (input.authorBio) book.authorBio = input.authorBio;
    if (input.genre) book.genre = input.genre;
    if (input.characters) book.characters = input.characters;
    if (input.ideaCore) book.ideaCore = input.ideaCore;
    if (input.numberOfChapters) book.numberOfChapters = input.numberOfChapters;
    if (input.targetAudience) book.targetAudience = input.targetAudience;
    if (input.language) book.language = input.language;

    await this.bookGenerationRepository.save(book);

    return {
      message: "Book image updated successfully",
    };
  }

  async regenerateBookImage(input: RegenerateImage) {
    await this.initializeAIModels(); // Ensure API keys are loaded before generating content

    const getBook = await this.bookGenerationRepository.findOne({
      where: { id: input.bookId },
    });

    if (!getBook) {
      throw new NotFoundException(`Book with ID ${input.bookId} not found`);
    }
    const promptData = {
      bookTitle: getBook.bookTitle,
      authorName: getBook.authorName,
      authorBio: getBook.authorBio,
      genre: getBook.genre || "", // Fallback to an empty string if missing
      characters: getBook.characters,
      bookInformation: getBook.ideaCore,
      numberOfChapters: getBook.numberOfChapters || 0, // Default to 0 if missing
      targetAudience: getBook.targetAudience,
      language: getBook.language,
      additionalContent: input.additionalContent,
    };
    let imageUrl;
    if (input.imageType == "cover")
      imageUrl = await this.regenerateBookCover(promptData, "front");
    else imageUrl = await this.regenerateBookCover(promptData, "back");
    if (input.imageType === "cover") {
      this.generateBookImage(imageUrl, promptData)
        .then(async (backCoverPath) => {
          // Retrieve the current book record
          const book = await this.bookGenerationRepository.findOne({
            where: { id: getBook.id },
          });
          if (!book) return;

          // Update `additionalData`
          book.additionalData = {
            ...book.additionalData,
            coverImageUrl: backCoverPath,
          };

          // Save the updated record
          await this.bookGenerationRepository.update(book.id, {
            additionalData: book.additionalData,
          });
        })
        .catch((error) =>
          this.logger.error(`❌ Failed to save back cover: ${error.message}`)
        );
    } else {
      this.generateBookImage(imageUrl, promptData)
        .then(async (backCoverPath) => {
          // Retrieve the current book record
          const book = await this.bookGenerationRepository.findOne({
            where: { id: getBook.id },
          });
          if (!book) return;

          // Update `additionalData`
          book.additionalData = {
            ...book.additionalData,
            backCoverImageUrl: backCoverPath,
          };

          // Save the updated record
          await this.bookGenerationRepository.update(book.id, {
            additionalData: book.additionalData,
          });
        })
        .catch((error) =>
          this.logger.error(`❌ Failed to save back cover: ${error.message}`)
        );
    }
  }

  async deleteBookById(id: number) {
    try {
      const getBookById = await this.getBook(id);
      return this.bookGenerationRepository.remove(getBookById);
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async getBooksByType(type: string, user: UserInterface) {
    try {
      const query = this.bookGenerationRepository
        .createQueryBuilder("bookGeneration")
        .leftJoinAndSelect("bookGeneration.bookChapter", "bookChapter")
        .where("bookGeneration.type = :type", { type });

      // Apply user-based filtering if the user is not an admin
      if (user.role !== "admin") {
        query.andWhere("bookGeneration.userId = :userId", { userId: user.id });
      }

      // Execute the query and return the result
      return await query.getMany();
    } catch (error) {
      // Enhanced error handling
      this.logger.error(
        `Error retrieving books of type '${type}' for user ID: ${user.id}`,
        error.stack
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  async searchBookQuery(userId: number, search: SearchDto) {
    try {
      // Prepare the query filter based on the provided search parameters
      const query: any = { userId };

      if (search.bookTitle) {
        query["bookTitle"] = { $regex: new RegExp(search.bookTitle, "i") }; // case-insensitive search
      }
      if (search.genre) {
        query["genre"] = search.genre;
      }
      if (search.theme) {
        query["theme"] = search.theme;
      }
      if (search.language) {
        query["language"] = search.language;
      }
      if (search.targetAudience) {
        query["targetAudience"] = search.targetAudience;
      }
      if (search.numberOfPages) {
        query["numberOfPages"] = search.numberOfPages;
      }

      // Optional: If 'isFlowChart' or 'isDiagram' is provided, filter by them
      if (search.isFlowChart !== undefined) {
        query["isFlowChart"] = search.isFlowChart;
      }
      if (search.isDiagram !== undefined) {
        query["isDiagram"] = search.isDiagram;
      }

      // Execute the search query to find matching books
      const books = await this.bookGenerationRepository.find(query);

      if (!books || books.length === 0) {
        throw new Error("No books found based on the search criteria.");
      }

      return books;
    } catch (error) {
      this.logger.error(`Error during book search: ${error.message}`);
      throw new Error("Failed to search books.");
    }
  }
}
