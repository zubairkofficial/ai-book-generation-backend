import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChatOpenAI, OpenAI as LangchainOpenAI } from "@langchain/openai"; // For text generation
import { PromptTemplate } from "@langchain/core/prompts";
import { ConfigService } from "@nestjs/config";
import { BookGeneration } from "./entities/book-generation.entity";
import OpenAI from "openai"; // For DALL·E image generation
import * as fs from "fs";
import * as path from "path";
import { ApiKey } from "src/api-keys/entities/api-key.entity";
import { exec } from "child_process";
import mermaid from "mermaid";
import {
  BookGenerationDto,
  RegenerateImage,
  SearchDto,
  UpdateBookCoverDto,
  UpdateBookDto,
  UpdateDto,
} from "./dto/book-generation.dto";
import { allowedSizes } from "src/common";
import { UserDto } from "src/auth/types/request-with-user.interface";
import axios from "axios";
import { UserInterface } from "src/users/dto/users.dto";

@Injectable()
export class BookGenerationService {
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
    private apiKeyRepository: Repository<ApiKey>
  ) {
    this.uploadsDir = this.setupUploadsDirectory();
  }
  private async initializeAIModels() {
    try {
      this.apiKeyRecord = await this.apiKeyRepository.find();
      if (!this.apiKeyRecord) {
        throw new Error("No API keys found in the database.");
      }

      this.textModel = new ChatOpenAI({
        openAIApiKey: this.apiKeyRecord[0].openai_key,
        temperature: 0.4,
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
      fs.writeFileSync(filePath, imageData);

      this.logger.log(`Image saved successfully: ${filePath}`);
      return path.join(subDirectory, fullFileName);
    } catch (error) {
      this.logger.error(`Error saving image: ${error.message}`);
      throw new Error("Failed to save image");
    }
  }

  private async saveFlowchartImage(
    mermaidCode: string,
    fileName: string
  ): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, "flowcharts");
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const mermaidFilePath = path.join(
        dirPath,
        `${sanitizedFileName}_${timestamp}.mmd`
      );
      const svgFilePath = path.join(
        dirPath,
        `${sanitizedFileName}_${timestamp}.svg`
      );

      // Write Mermaid.js syntax to a file
      fs.writeFileSync(mermaidFilePath, mermaidCode, "utf-8");

      // Use mermaid-cli (mmdc) to generate SVG
      await new Promise((resolve, reject) => {
        exec(
          `npx mmdc -i "${mermaidFilePath}" -o "${svgFilePath}"`,
          (error, stdout, stderr) => {
            if (error) {
              reject(`Error executing Mermaid CLI: ${stderr}`);
            } else {
              resolve(stdout);
            }
          }
        );
      });

      this.logger.log(`Flowchart saved: ${svgFilePath}`);
      return path.join("flowcharts", `${sanitizedFileName}_${timestamp}.svg`);
    } catch (error) {
      this.logger.error(`Error saving flowchart: ${error.message}`);
      throw new Error("Failed to save flowchart");
    }
  }
  private async saveDiagramImage(
    mermaidCode: string,
    fileName: string
  ): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, "graphs");
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const mermaidFilePath = path.join(
        dirPath,
        `${sanitizedFileName}_${timestamp}.mmd`
      );
      const svgFilePath = path.join(
        dirPath,
        `${sanitizedFileName}_${timestamp}.svg`
      );

      // Write Mermaid.js syntax to a file
      fs.writeFileSync(mermaidFilePath, mermaidCode, "utf-8");

      // Use mermaid-cli (mmdc) to generate SVG
      await new Promise((resolve, reject) => {
        exec(
          `npx mmdc -i "${mermaidFilePath}" -o "${svgFilePath}"`,
          (error, stdout, stderr) => {
            if (error) {
              reject(`Error executing Mermaid CLI: ${stderr}`);
            } else {
              resolve(stdout);
            }
          }
        );
      });

      this.logger.log(`Flowchart saved: ${svgFilePath}`);
      return path.join("graphs", `${sanitizedFileName}_${timestamp}.svg`);
    } catch (error) {
      this.logger.error(`Error saving flowchart: ${error.message}`);
      throw new Error("Failed to save flowchart");
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
          ? `Design a visually striking and professional front cover for "${promptData.bookTitle}".`
          : `Generate a professional back cover for "${promptData.bookTitle}".`;

      if (promptData.bookInformation) {
        coverPrompt += ` The book explores the following theme: ${promptData.bookInformation}.`;
      }
      if (promptData.additionalContent) {
        coverPrompt += ` Additional notes for the cover: ${promptData.additionalContent}.`;
      }

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
            this.configService.get<string>("BASE_URL_FAL_AI"),
            requestData,
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
    coverType: "front" | "back"
  ): Promise<string> {
    try {
      const maxRetries = 5; // Retry up to 5 times
      const delayMs = 3000; // Wait 3 seconds between retries

      const coverPrompt =
        coverType === "front"
          ? `Design a visually striking and professional front cover for "${promptData.bookTitle}".`
          : `Generate a professional back cover for "${promptData.bookTitle}".`;

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
            this.configService.get<string>("BASE_URL_FAL_AI"),
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

  private getDefaultStyling() {
    return {
      diagramConfig: {
        theme: "base",
        themeVariables: {
          primaryColor: "#F6F6F6",
          edgeLabelBackground: "#FFFFFF",
          fontSize: "16px",
          fontFamily: "Arial",
        },
      },
      diagramStyles: {
        decisionNodes: { shape: "diamond", color: "#FFA500" },
        actionNodes: { shape: "rect", color: "#87CEEB" },
        outcomeNodes: { shape: "roundRect", color: "#90EE90" },
      },
    };
  }

  private async introductionContent(promptData: BookGenerationDto) {
    try {
      this.logger.log(
        `📖 Generating Introduction Content for: "${promptData.bookTitle}"`
      );

      // Prepare all prompts (UNCHANGED)
      const coverPagePrompt = `
        Create a professional Cover Page with the following details:
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
      It can express gratitude or motivation, depending on the tone of the book.
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

  private async generateDiagram(
    chapterContent: string,
    chapterNumber: number,
    bookTitle: string
  ): Promise<string> {
    try {
      const diagramPrompt = `
        Analyze this chapter content and generate a Mermaid.js diagram:
        "${chapterContent}"
        
        Requirements:
        - Use either graph TD (top-down) or graph LR (left-right)
        - Focus on character interactions and plot progression
        - Include key decision points and consequences
        - Use emojis in node labels where appropriate
        - Maximum 15 nodes
        - Style Requirement: ${this.getDefaultStyling().diagramStyles}
  
        Format:
        graph TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Action 1]
          B -->|No| D[Action 2]
      `;

      const response = await this.textModel.invoke(diagramPrompt);
      let diagramCode = response.content
        .replace(/```mermaid/g, "")
        .replace(/```/g, "")
        .trim();

      // Add styling configuration
      diagramCode = `%%{init: ${JSON.stringify(this.getDefaultStyling().diagramConfig)} }%%\n${diagramCode}`;

      return this.saveDiagramImage(
        diagramCode,
        `chapter_${chapterNumber}_diagram`
      );
    } catch (error) {
      this.logger.error(`Diagram generation failed: ${error.message}`);
      return ""; // Fail gracefully
    }
  }

  private async endOfBookContent(
    promptData: BookGenerationDto
  ) {
    try {
      this.logger.log(
        `📖 Generating End-of-Book Content for: "${promptData.bookTitle}"`
      );

      // Prepare prompts (UNCHANGED)
      const glossaryPrompt = `
      Create a comprehensive glossary for the book titled "${promptData.bookTitle}". 
      Include definitions for key terms, concepts, and jargon that are central to the book's content. 
      Make sure the definitions are clear and accessible to the reader, reflecting the book's core theme: "${promptData.bookInformation}".
      Organize the glossary alphabetically and ensure that each term is explained concisely and accurately.
    `;

      const indexPrompt = `
      Create a detailed index for the book titled "${promptData.bookTitle}". 
      The index should include important topics, concepts, and references that appear in the book. 
      Ensure that each entry is well-organized, with corresponding page numbers, and reflects the core themes and ideas explored in the book: "${promptData.bookInformation}".
      The index should help readers easily navigate through the material based on their interests or research needs.
    `;

      const referencesPrompt = `
      Write a comprehensive bibliography for the book titled "${promptData.bookTitle}". 
      Include references to any studies, articles, books, or other materials that were used or inspired the content of the book. 
      The references should align with the core idea: "${promptData.bookInformation}" and provide additional reading for those interested in further exploration of the book's topics.
      Ensure that the citations are formatted according to a standard citation style (e.g., APA, MLA, Chicago).
    `;

      // **Run AI calls in parallel** for faster execution
      const [glossaryResponse, indexResponse, referencesResponse] =
        await Promise.all([
          this.textModel.invoke(glossaryPrompt),
          this.textModel.invoke(indexPrompt),
          this.textModel.invoke(referencesPrompt),
        ]);

      // **Fast String Concatenation**
      return {
        glossary: glossaryResponse.content,
        index: indexResponse.content,
        references: referencesResponse.content,
      };
      // Efficient joining
    } catch (error) {
      this.logger.error(
        `❌ Error generating end-of-book content: ${error.message}`
      );
      throw new Error("Failed to generate end-of-book content");
    }
  }

  private async generateFlowchart(promptText: string): Promise<string> {
    try {
      const flowchartPrompt = `
        Generate a valid Mermaid.js flowchart using this description:
        "${promptText}"
        Ensure the response starts with "graph TD" or "graph LR".
        Do not include any extra text, explanations, or markdown code blocks (e.g., do not wrap in \`\`\`mermaid ... \`\`\`).
      `;

      const response = await this.textModel.invoke(flowchartPrompt);

      let flowchartCode =
        typeof response === "string" ? response : response?.content || "";

      flowchartCode = flowchartCode
        .replace(/```mermaid/g, "")
        .replace(/```/g, "")
        .trim();

      if (!flowchartCode.includes("graph")) {
        throw new Error("Invalid Mermaid.js output from AI.");
      }
      if (
        flowchartCode.startsWith("graph TD") &&
        !flowchartCode.startsWith("graph TD\n")
      ) {
        flowchartCode = flowchartCode.replace("graph TD", "graph TD\n");
      }
      // Similarly for graph LR if needed.

      const filePath = await this.saveFlowchartImage(
        flowchartCode,
        "flowchart"
      );
      return filePath;
    } catch (error) {
      this.logger.error(`Error generating flowchart: ${error.message}`);
      throw new Error("Failed to generate flowchart");
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
        where: { userId: userId },
      });
    else return await this.bookGenerationRepository.count();
  }

  async generateAndSaveBook(
    userId: number,
    promptData: BookGenerationDto
  ): Promise<BookGeneration> {
    try {
      await this.initializeAIModels(); // Ensure API keys are loaded before generating content

      // **Run AI Content & Image Generation in Parallel**
      const [bookContentResult, coverImageResult, backCoverImageResult] =
        await Promise.allSettled([
          this.createBookContent(promptData), // Generate book content
          this.generateBookCover(promptData, "front"), // Generate front cover (URL)
          this.generateBookCover(promptData, "back"), // Generate back cover (URL)
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
      book.userId = userId;
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
        backCoverImageUrl: null, // To be updated when image is ready
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

        if (backCoverImageResult.status === "fulfilled") {
          imageDownloadTasks.push(
            this.generateBookImage(backCoverImageResult.value, promptData)
              .then(async (backCoverPath) => {
                // Retrieve the current book record
                const book = await this.bookGenerationRepository.findOne({
                  where: { id: savedBook.id },
                });
                if (!book) return;

                // Update `additionalData`
                book.additionalData = {
                  ...book.additionalData,
                  backCoverImageUrl: backCoverPath,
                };

                // Save the updated record
                await this.bookGenerationRepository.update(savedBook.id, {
                  additionalData: book.additionalData,
                });
              })
              .catch((error) =>
                this.logger.error(
                  `❌ Failed to save back cover: ${error.message}`
                )
              )
          );
        }
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
      // **Immediately save book metadata (Images still downloading)**
      book.userId = userId;
      book.additionalData = {
          
         coverPageResponse:input.coverPageResponse??book.additionalData.coverPageResponse,
          dedication:input.dedication??book.additionalData.dedication,
          preface:input.preface??book.additionalData.preface,
          introduction:input.introduction??book.additionalData.introduction,
          references:input.references??book.additionalData.references,
          index:input.index??book.additionalData.index,
          glossary:input.glossary??book.additionalData.glossary,
        coverImageUrl: book.additionalData.coverImageUrl,
        tableOfContents:input.tableOfContents?? book.additionalData.tableOfContents,
        backCoverImageUrl: book.additionalData.backCoverImageUrl,
      };

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
