import { Injectable, Logger } from "@nestjs/common";
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
import { BookGenerationDto, SearchDto } from "./dto/book-generation.dto";
import { allowedSizes } from "src/common";
import { UserDto } from "src/auth/types/request-with-user.interface";
import axios from "axios";

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

  private async generateBookSummary(
    promptData: BookGenerationDto
  ): Promise<string> {
    try {
      const summaryPrompt = `Generate maximum 400 characters length of summary for "${promptData.bookTitle}". 
      Consider the following aspects:
      - Genre: ${promptData.genre}
      - Target audience: ${promptData.targetAudience || "General readers"}
      - CoreIdea: ${promptData.bookInformation}
      
      Provide a compelling and vivid description that captures the essence of the book.`;

      const response = await this.textModel.invoke(summaryPrompt);
      console.log("Summary of Dall", summaryPrompt, response);
      return response.content.toString();
    } catch (error) {
      this.logger.error(`Error generating book summary: ${error.message}`);
      throw new Error("Failed to generate book summary");
    }
  }

  private async generateBookImage(responseUrl, promptData): Promise<string> {
    try {
      const getResponse = await axios.get(responseUrl, {
        headers: {
          Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
          "Content-Type": "application/json",
        },
      });

      // If the image is ready

      const dirPath = path.join(this.uploadsDir, "covers");

      const imageUrl = getResponse.data.images[0].url;
      // Once the image is ready, download and save it
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      // Define the sanitized file name for the image
      const timestamp = new Date().getTime();
      const sanitizedFileName = promptData.bookTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fullFileName = `${sanitizedFileName}_${timestamp}.png`;

      // Define the path to save the image in the 'uploads/covers/images' folder
      const imagePath = path.join(dirPath, `${fullFileName}`);

      // Ensure the 'covers/images' folder exists, create if it doesn't
      const imageFolderPath = path.dirname(imagePath);
      if (!fs.existsSync(imageFolderPath)) {
        fs.mkdirSync(imageFolderPath, { recursive: true });
      }

      // Save the image to the specified folder
      fs.writeFileSync(imagePath, imageResponse.data);

      // Return the relative endpoint (e.g., /cover/image_name)
      const relativePath = `covers/${fullFileName}`;
      return relativePath;
    } catch (error) {
      this.logger.error(`Error generating book cover: ${error.message}`);
      throw new Error(error.message);
    }
  }
  private async generateBookCover(
    promptData: BookGenerationDto,
    coverType: "front" | "back",
   
  ): Promise<string> {
    try {
      type AllowedSize = (typeof allowedSizes)[number];
      const imageSize = this.configService.get<string>(
        "IMAGE_SIZE"
      ) as AllowedSize;

      if (!allowedSizes.includes(imageSize)) {
        throw new Error(
          `Invalid image size: ${imageSize}. Allowed sizes are: ${allowedSizes.join(", ")}`
        );
      }

      const dirPath = path.join(this.uploadsDir, "covers");
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      // Adjust the prompt based on coverType
      const coverPrompt =
  coverType === "front"
    ? `Design a visually striking and professional front cover for a book titled "${promptData.bookTitle}". The cover should reflect the book's core theme: "${promptData.bookInformation}". Use a creative, high-quality design that aligns with the book's genre and mood. Include the title prominently, an engaging background, and the author's name in a well-balanced layout. Avoid excessive text clutter; focus on a compelling, visually appealing composition.`
    : `Generate a professional back cover for a book titled "${promptData.bookTitle}". The design should complement the front cover and reflect the core theme: "${promptData.bookInformation}". Ensure space for a book summary, author bio, and possibly a small author photo. Maintain a structured and aesthetically pleasing layout with balanced text placement. Avoid excessive text that overwhelms the design.`;


      const requestData = {
        prompt: coverPrompt, // Adjusted prompt based on cover type
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: "2",
        output_format: "jpeg",
        aspect_ratio: "9:16",
        raw: false,
        // Add other fields as required by the API
      };

      // Send the POST request to generate the cover
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

      const responseUrl = postResponse.data.response_url;

       return responseUrl;
      
    } catch (error) {
      this.logger.error(`Error generating book cover: ${error.message}`);
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
      const sections: string[] = [];
      const coverPagePrompt = `
        Create a professional Cover Page with the following details:
        - Title: "${promptData.bookTitle}"
        - Author: "${promptData.authorName || "Anonymous"}"
        - Publisher: ${promptData.authorName || "AiBookPublisher"}
        - AuthorBio: ${promptData.authorBio || "Writter"}
        - Language: ${promptData.language || "English"}
        - CoreIdea: ${promptData.bookInformation}
      `;
      const coverPageResponse = await this.textModel.invoke(coverPagePrompt);

      const coverPage =
        typeof coverPageResponse === "string"
          ? coverPageResponse
          : coverPageResponse?.text || JSON.stringify(coverPageResponse);

      sections.push(` Cover Page\n${coverPage}\n`);

      // Dedication Page
      const dedicationPrompt = `
        Write a dedication for the book titled "${promptData.bookTitle}".
      `;
      const dedicationResponse = await this.textModel.invoke(dedicationPrompt);
      const dedication =
        typeof dedicationResponse === "string"
          ? dedicationResponse
          : dedicationResponse?.text || JSON.stringify(dedicationResponse);

      sections.push(`Dedication\n${dedication}\n`);

      // Preface/Introduction
      const prefacePrompt = `
        Write a compelling preface for the book titled "${promptData.bookTitle}".
        Include sections like Overview, Use in Curriculum, Goals, and Acknowledgments.
      `;
      const prefaceResponse = await this.textModel.invoke(prefacePrompt);
      const preface =
        typeof prefaceResponse === "string"
          ? prefaceResponse
          : prefaceResponse?.text || JSON.stringify(prefaceResponse);

      sections.push(` Preface\n${preface}\n`);

      // Table of Contents
      const tableOfContentsPrompt = `
  Create a list of unique, engaging chapter titles for a book with ${promptData.numberOfChapters} chapters. Each title should reflect the theme of the book and evoke curiosity. The titles should be concise, descriptive, and hint at the main events or ideas in each chapter.

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

      const tableOfContentsResponse = await this.textModel.invoke(
        tableOfContentsPrompt
      );
      const tableOfContents =
        typeof tableOfContentsResponse === "string"
          ? tableOfContentsResponse
          : tableOfContentsResponse?.text ||
            JSON.stringify(tableOfContentsResponse);

      // sections.push(` Table of Contents\n${tableOfContents}\n`);

      return { section: sections.join("\n"), tableOfContents };
    } catch (error) {
      this.logger.error(
        `Error generating introduction content: ${error.message}`
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
  ): Promise<string> {
    try {
      const sections: string[] = [];

      // Glossary
      const glossaryPrompt = `
        Create a glossary for the book titled "${promptData.bookTitle}". Include definitions of key terms used in the book.
      `;
      const glossaryResponse = await this.textModel.invoke(glossaryPrompt); // Replace with actual API call or logic
      const glossary =
        typeof glossaryResponse === "string"
          ? glossaryResponse
          : glossaryResponse?.text || JSON.stringify(glossaryResponse);

      sections.push(` Glossary\n${glossary}\n`);

      // Index
      const indexPrompt = `
        Create an index for the book titled "${promptData.bookTitle}". Include key topics with page numbers.
      `;
      const indexResponse = await this.textModel.invoke(indexPrompt); // Replace with actual API call or logic
      const prefacePrompt = `
        Write a compelling preface for the book titled "${promptData.bookTitle}".
        Include sections like Overview, Use in Curriculum, Goals, and Acknowledgments.
      `;
      const prefaceResponse = await this.textModel.invoke(prefacePrompt);
      const preface =
        typeof prefaceResponse === "string"
          ? prefaceResponse
          : prefaceResponse?.text || JSON.stringify(prefaceResponse);

      sections.push(` Preface\n${preface}\n`);
      const index =
        typeof indexResponse === "string"
          ? indexResponse
          : indexResponse?.text || JSON.stringify(indexResponse);

      sections.push(` Index\n${index}\n`);

      // References/Bibliography
      const referencesPrompt = `
        Write a bibliography for the book titled "${promptData.bookTitle}". Include any references or inspirations.
      `;
      const referencesResponse = await this.textModel.invoke(referencesPrompt); // Replace with actual API call or logic
      const references =
        typeof referencesResponse === "string"
          ? referencesResponse
          : referencesResponse?.text || JSON.stringify(referencesResponse);

      sections.push(` References\n${references}\n`);

      // Combine all sections into a single string
      const endOfBookContent = sections.join("\n");
      return endOfBookContent;
    } catch (error) {
      console.error("Error generating end-of-book content:", error);
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
      const sections: string[] = [];

      // Generate Introduction Content
      const { section, tableOfContents } =
        await this.introductionContent(promptData);
      sections.push(section);

      // Generate End-of-Book Content
      const endOfBook = await this.endOfBookContent(promptData);
      sections.push(endOfBook);

      // Combine all sections into a single string
      const fullBookContent = sections.join("\n\n");
      return { fullBookContent, tableOfContents };
    } catch (error) {
      this.logger.error(`Error creating book content: ${error.message}`);
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
    return await this.bookGenerationRepository.findOne({ where: { id } });
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

      const coverImageUrl = await this.generateBookCover(promptData, "front"); // Front cover
      const backgroundImageUrl = await this.generateBookCover(
        promptData,
        "back"
      ); // Back cover

      const { fullBookContent, tableOfContents } =
        await this.createBookContent(promptData);
      const coverImagePath = await this.generateBookImage(
        coverImageUrl,
        promptData
      ); // Front cover
      const backgroundImagePath = await this.generateBookImage(
        backgroundImageUrl,
        promptData
      ); // Back cover

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
        coverImageUrl: coverImagePath,
        fullContent: fullBookContent,
        backCoverImageUrl: backgroundImagePath,
        tableOfContents: tableOfContents,
      };

      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(
        `Book saved successfully for user ${userId}: ${promptData.bookTitle}`
      );

      return savedBook;
    } catch (error) {
      this.logger.error(`Error generating and saving book: ${error.message}`);
      throw new Error(error.message);
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
