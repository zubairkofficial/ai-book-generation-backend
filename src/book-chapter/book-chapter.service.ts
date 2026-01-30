import { SettingsService } from './../settings/settings.service';
import { ChatOpenAI } from "@langchain/openai";
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiKey } from "src/api-keys/entities/api-key.entity";
import { Repository } from "typeorm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { concat } from "@langchain/core/utils/stream";
import type { AIMessageChunk } from "@langchain/core/messages";
import {
  BookChapterDto,
  BookChapterGenerationDto,
  BookChapterUpdateDto,
} from "./dto/book-chapter.dto";
import {
  BookGeneration,
} from "src/book-generation/entities/book-generation.entity";
import { BookChapter } from "./entities/book-chapter.entity";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import axios from "axios";
import { get as levenshtein } from "fast-levenshtein";
import { Settings } from 'src/settings/entities/settings.entity';
import { UsersService } from 'src/users/users.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { UsageType } from 'src/subscription/entities/usage.entity';
import { UserRole } from 'src/users/entities/user.entity';
import { BookHtmlContent } from 'src/book-html-content/entities/book-html-content.entity';
import { MarkdownConverter } from 'src/utils/markdown-converter.util';

@Injectable()
export class BookChapterService {
  private textModel;
  private settingPrompt: Settings;
  private apiKeyRecord;
  private userInfo;
  private userKeyRecord;
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
    private apiKeyRepository: Repository<ApiKey>,

    private settingsService: SettingsService,
    private userService: UsersService,
    private readonly subscriptionService: SubscriptionService,
    @InjectRepository(BookHtmlContent)
    private bookHtmlContentRepository: Repository<BookHtmlContent>,
    private readonly markdownConverter: MarkdownConverter,

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

  private validateUserSubscription(noOfImages?: number): void {
    if (!this.userKeyRecord) {
      throw new Error('No subscription package found.');
    }

    const { totalImages, imagesGenerated } = this.userKeyRecord;

    if (
      totalImages < imagesGenerated ||
      (noOfImages && totalImages - imagesGenerated < noOfImages)
    ) {
      throw new UnauthorizedException('Exceeded maximum image generation limit');
    }
  }

  private calculateMaxTokens(): number {
    const { totalTokens, tokensUsed } = this.userKeyRecord;
    const remainingTokens = totalTokens - tokensUsed;

    if (remainingTokens < 500) {
      throw new BadRequestException('Token limit exceeded');
    }

    return Math.min(remainingTokens, 4000);
  }

  async regenerateChapterImage(
    userId: number,
    bookGenerationId: number,
    chapterNo: number,
    originalImageUrl: string,
    newPrompt?: string
  ): Promise<string> {
    try {
      if (!originalImageUrl) {
        throw new Error("Original image URL is required");
      }

      await this.initializeAIModels(userId);

      // Verify book and chapter exist
      const bookChapter = await this.bookChapterRepository.findOne({
        where: {
          bookGeneration: { id: bookGenerationId },
          chapterNo: chapterNo,
        },
        relations: ["bookGeneration"],
      });

      if (!bookChapter) {
        throw new Error("Chapter not found");
      }

      const bookInfo = bookChapter.bookGeneration;

      // 1. Construct Prompt
      // If user provided a specific prompt, use it.
      // Otherwise, we might want to try to infer context, but for regeneration, a manual prompt is best.
      // If no prompt, fallback to a generic one or error? Let's assume user provides one, or we use a generic style.
      const imagePrompt = `
        Create a high-quality illustration for:
        - Book: "${bookInfo.bookTitle}" (Genre: ${bookInfo.genre})
        - Chapter: ${chapterNo}
        ${newPrompt ? `- Specific Instruction: "${newPrompt}"` : ""}
        - Style: "${this.settingPrompt.chapterImagePrompt}"
        
        Make it visually striking and contextually accurate.
      `;

      // 2. Call Image Generation API (Fal.ai)
      let imageUrl: string | null = null;

      const postResponse = await axios.post(
        this.userInfo.role === UserRole.USER
          ? this.userKeyRecord.package ? this.userKeyRecord?.package.imageModelURL : this.settingPrompt.coverImageDomainUrl
          : this.settingPrompt.coverImageDomainUrl ?? this.configService.get<string>("BASE_URL_FAL_AI"),
        { prompt: imagePrompt },
        {
          headers: {
            Authorization: `Key ${this.apiKeyRecord.fal_ai}`,
            "Content-Type": "application/json",
          },
        }
      );

      const imageResponseUrl = postResponse.data.response_url;

      // Poll for result
      const maxRetries = 60; // 60 * 2s = 120s
      const delayMs = 2000;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          const getRes = await axios.get(imageResponseUrl, { headers: { Authorization: `Key ${this.apiKeyRecord.fal_ai}` } });
          if (getRes.data.images?.length > 0) {
            imageUrl = getRes.data.images[0].url;
            break;
          }
          if (getRes.data?.detail?.includes("Exhausted balance")) throw new Error("Exhausted balance");
        } catch (e) {
          // ignore poll error
        }
        await new Promise(r => setTimeout(r, delayMs));
        attempt++;
      }

      if (!imageUrl) {
        throw new Error("Failed to generate image or timed out.");
      }

      // 3. Save Image Locally
      const savedPath = await this.saveGeneratedImage(imageUrl, bookInfo.bookTitle, userId);

      // 4. Update Markdown Content
      // Replace the old URL with the new saved path
      // We need to be careful about matching. The markdown has format: ![AltText](URL)
      // We will look for explicit URL match.

      // We need to use 'savedPath' which is the full URL to the new image.
      // The content stores the image with the full URL.

      // Handle potential encoding differences or relative paths if any
      // For now, simple string replacement of the specific URL.
      if (bookChapter.chapterInfo.includes(originalImageUrl)) {
        bookChapter.chapterInfo = bookChapter.chapterInfo.replace(originalImageUrl, savedPath);
        await this.bookChapterRepository.save(bookChapter);
      } else {
        // Fallback: try to find by filename if full URL doesn't match?
        // Or throw warning?
        this.logger.warn(`Could not find exact original URL "${originalImageUrl}" in chapter content to replace.`);
        // We still return the new image, maybe client can handle if it was just a mismatch in stored vs sent
      }

      // Track usage
      if (this.userInfo.role === UserRole.USER) {
        // Assuming 0 tokens for image gen itself in tracking, or estimated? 
        // Existing logic used 0 tokens, 1 image count.
        await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, 0, 1);
        await this.subscriptionService.trackTokenUsage(userId, "chapterImageRegenerate", UsageType.IMAGE, { chapterImage: savedPath }, bookInfo, chapterNo);
      }


      // 5. Update HTML Content
      await this.updateChapterHtmlContent(bookChapter);

      return savedPath;

    } catch (error) {
      this.logger.error(`Error regenerating chapter image: ${error.message}`);
      throw new Error(error.message);
    }
  }

  async uploadChapterImage(
    userId: number,
    bookGenerationId: number,
    chapterNo: number,
    originalImageUrl: string,
    file: Express.Multer.File
  ): Promise<string> {
    try {
      // Validate inputs
      if (!file) throw new Error("No file provided");
      if (!originalImageUrl) throw new Error("Original image URL required for replacement");

      // Fetch Chapter
      const bookChapter = await this.bookChapterRepository.findOne({
        where: {
          bookGeneration: { id: bookGenerationId },
          chapterNo: chapterNo,
        },
      });

      if (!bookChapter) {
        throw new Error("Chapter not found");
      }

      // Save uploaded file
      const dirPath = path.join(this.uploadsDir, "chapters");
      const baseUrl = this.configService.get<string>("BASE_URL");

      // Unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `manual_upload_${bookGenerationId}_${chapterNo}_${timestamp}${ext}`;
      const filePath = path.join(dirPath, filename);

      fs.writeFileSync(filePath, file.buffer);
      const newImageUrl = `${baseUrl}/uploads/chapters/${filename}`;

      // Update Content
      if (bookChapter.chapterInfo.includes(originalImageUrl)) {
        bookChapter.chapterInfo = bookChapter.chapterInfo.replace(originalImageUrl, newImageUrl);
        await this.bookChapterRepository.save(bookChapter);
      } else {
        this.logger.warn(`Could not find original URL "${originalImageUrl}" to replace in content.`);
      }


      // Update HTML Content
      await this.updateChapterHtmlContent(bookChapter);

      return newImageUrl;

    } catch (error) {
      this.logger.error(`Error uploading chapter image: ${error.message}`);
      throw new Error(error.message);
    }
  }



  private selectModelName(): string {
    const isAdmin = this.userInfo.role === UserRole.ADMIN;
    const hasNoPackage = !this.userKeyRecord?.package;

    const model = (isAdmin || hasNoPackage)
      ? this.apiKeyRecord?.modelType
      : this.userKeyRecord?.package?.modelType;

    return model || "gpt-4o";
  }





  private async initializeAIModels(userId: number, noOfImages?: number) {
    try {
      // Fetch user profile
      this.userInfo = await this.userService.getProfile(userId);
      if (!this.userInfo) {
        throw new NotFoundException('User does not exist');
      }

      // Fetch API key
      [this.apiKeyRecord] = await this.apiKeyRepository.find();
      if (!this.apiKeyRecord) {
        throw new Error('No API keys found in the database.');
      }

      // Fetch user's active subscription
      [this.userKeyRecord] = await this.subscriptionService.getUserActiveSubscription(userId);
      // Load settings
      this.settingPrompt = await this.settingsService.getAllSettings();
      if (!this.settingPrompt) {
        throw new Error('No setting prompt found in the database.');
      }
      // Validate subscription (only for USER role)
      if (this.userInfo.role === UserRole.USER) {
        this.validateUserSubscription(noOfImages);
      }



      // Determine max completion tokens if not admin
      const maxCompletionTokens = this.userInfo.role === UserRole.USER
        ? this.calculateMaxTokens()
        : undefined;

      // Initialize text model
      this.textModel = new ChatOpenAI({
        openAIApiKey: this.apiKeyRecord.openai_key,
        temperature: 0.4,
        modelName: this.selectModelName(),
        maxTokens: maxCompletionTokens,
        timeout: 600000, // 10 minutes timeout to prevent Premature Close errors
      });

      this.logger.log(`AI Models initialized successfully with model: ${this.selectModelName()}`);
    } catch (error) {
      this.logger.error(`Failed to initialize AI models: ${error.message}`);
      throw new Error(error.message);
    }
  }


  private async saveGeneratedImage(
    imageUrl: string,
    bookTitle: string,
    userId: number
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
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=_`~()]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }


  private matchKeyPointsWithText(
    chapterText: string,
    keyPoints: string[]
  ): { keyPoint: string; sentence: string; position: number }[] {
    const chapterSentences = chapterText
      .split(/(?<=[.?!])\s+|[\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const matches: { keyPoint: string; sentence: string; position: number }[] = [];
    let lastUsedPosition = -1;

    // Match key points in order while maintaining text sequence
    keyPoints.forEach(keyPoint => {
      const cleanKey = this.normalizeText(keyPoint);
      let bestMatch: { score: number; index: number } | null = null;

      // Only look at sentences after previous matches
      for (let i = lastUsedPosition + 1; i < chapterSentences.length; i++) {
        if (matches.some(m => m.position === i)) continue;

        const sentenceClean = this.normalizeText(chapterSentences[i]);
        const exactMatch = sentenceClean.includes(cleanKey);
        const distance = exactMatch ? 0 : levenshtein(cleanKey, sentenceClean);
        const score = exactMatch ? distance - 1000 : distance; // Prioritize exact matches

        if (!bestMatch || score < bestMatch.score) {
          bestMatch = { score, index: i };
        }
      }

      if (bestMatch) {
        matches.push({
          keyPoint,
          sentence: chapterSentences[bestMatch.index],
          position: bestMatch.index
        });
        lastUsedPosition = bestMatch.index;
      }
    });

    return matches.sort((a, b) => a.position - b.position);
  }

  private insertImagesIntoChapter(
    chapterText: string,
    keyPoints: string[],
    chapterImages: { title: string; url: string | null }[]
  ): string {
    const sentences = chapterText.split(/(?<=[.?!])\s+|[\n]/);
    const matches = this.matchKeyPointsWithText(chapterText, keyPoints);
    const fallbackImageUrl = this.configService.get<string>("FALLBACK_IMAGE_URL");

    // Create a map of sentence positions to images
    const imageMap = new Map<number, { title: string; url: string | null }>();
    matches.forEach((match, index) => {
      if (index < chapterImages.length) {
        imageMap.set(match.position, chapterImages[index]);
      }
    });

    // Build content with images inserted in sequence
    let formattedChapter = '';
    sentences.forEach((sentence, index) => {
      formattedChapter += sentence + '\n\n';

      if (imageMap.has(index)) {
        const img = imageMap.get(index);
        const keyPoint = matches.find(m => m.position === index)?.keyPoint || '';

        if (img?.url) {
          formattedChapter += `\n\n![${img.title}](${img.url})\n\n`;
        } else if (fallbackImageUrl) {
          formattedChapter += `\n\n![Fallback Image](${fallbackImageUrl})\n\n`;
        }
      }
    });

    return formattedChapter;
  }


  private async pollImageGeneration(
    responseUrl: string,
    bookTitle: string,
    keyPoint: string,
    index: number,
    chapterImages: { title: string; url: string | null }[],
    userId: number
  ): Promise<void> {
    const maxRetries = 60; // Retry for up to 2 minutes
    const delayMs = 2000; // Wait 2 seconds per retry

    let attempt = 0;
    let imageUrl: string | null = null;

    while (attempt < maxRetries) {
      try {
        const getResponse = await axios.get(responseUrl, {
          headers: {
            Authorization: `Key ${this.apiKeyRecord.fal_ai}`,
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
    const savedImagePath = await this.saveGeneratedImage(imageUrl, bookTitle, userId);

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



  private async updateChapterHtmlContent(bookChapter: BookChapter): Promise<void> {
    try {
      // Find the HTML content for this book
      let htmlContent = await this.bookHtmlContentRepository.findOne({
        where: { book: { id: bookChapter.bookGeneration.id } }
      });

      if (!htmlContent) {
        this.logger.warn(`No BookHtmlContent found for book ID: ${bookChapter.bookGeneration.id}. Skipping HTML update.`);
        return;
      }

      // Initialize chaptersHtml if it doesn't exist
      if (!htmlContent.chaptersHtml) {
        htmlContent.chaptersHtml = [];
      }

      // Convert the updated markdown to HTML
      const newHtml = await this.markdownConverter.convert(bookChapter.chapterInfo);

      // Check if this chapter already exists in the HTML array
      const chapterIndex = htmlContent.chaptersHtml.findIndex(
        c => c.chapterNo === bookChapter.chapterNo
      );

      if (chapterIndex !== -1) {
        // Update existing entry
        htmlContent.chaptersHtml[chapterIndex] = {
          chapterNo: bookChapter.chapterNo,
          chapterName: bookChapter.chapterName,
          contentHtml: newHtml
        };
      } else {
        // Add new entry
        htmlContent.chaptersHtml.push({
          chapterNo: bookChapter.chapterNo,
          chapterName: bookChapter.chapterName,
          contentHtml: newHtml
        });
      }

      // Ensure chapters are sorted (optional but good practice)
      htmlContent.chaptersHtml.sort((a, b) => a.chapterNo - b.chapterNo);

      // Save the updated HTML content
      await this.bookHtmlContentRepository.save(htmlContent);
      this.logger.log(`Updated HTML content for chapter ${bookChapter.chapterNo} of book ID ${bookChapter.bookGeneration.id}`);

    } catch (error) {
      this.logger.error(`Failed to update chapter HTML content: ${error.message}`, error.stack);
      // We don't want to fail the entire image generation if HTML update fails, 
      // but we should log it.
    }
  }

  private async generateChapterSummary(chapterText: string, bookInfo: BookGeneration, userId: number): Promise<string> {
    try {
      if (!chapterText || chapterText.trim().length === 0) {
        throw new Error("Chapter text is empty or invalid.");
      }

      // Create the prompt for summarization
      const prompt = `
        Summarize the following chapter content into a concise and engaging summary:
        -**Language**:${bookInfo.language}
        Chapter Text:
        ${chapterText}
        
        Provide a summary that is no more than 3-4 sentences long, highlighting the main points of the chapter.
      `;

      // Use the model from this.textModel dynamically
      const response = await this.textModel.invoke(prompt);
      if (this.userInfo.role === UserRole.USER) {
        const { totalTokens } = await this.getUsage(response, prompt)
        await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
        await this.subscriptionService.trackTokenUsage(userId, "chapterSummary", UsageType.TOKEN, { summaryTokens: totalTokens });
      }
      // Log the response for debugging
      this.logger.log(
        "OpenAI API Response:",
        JSON.stringify(response, null, 2)
      );

      // Extract and return the generated summary
      return response.content;
    } catch (error) {
      // Log detailed error information
      this.logger.error(
        `Error generating chapter summary: ${error.message}`,
        error.stack
      );
      throw new Error(`Failed to generate chapter summary: ${error.message}`);
    }
  }

  private async ChapterContent(
    promptData: BookChapterGenerationDto,
    bookInfo: BookGeneration,
    bookChapter: boolean,
    userId: number,
    onTextUpdate: (text: string) => void
  ): Promise<string> {
    try {
      const memory = new ConversationSummaryBufferMemory({
        llm: this.textModel,
        memoryKey: "chapter_summary",
        returnMessages: true,
      });

      let updatePrompt: string;

      // Step 1: If 'bookChapter' is true, clear only the current chapter memory for the full chapter generation,
      // but do not clear memory if only a paragraph is being regenerated.
      if (bookChapter && !promptData.selectedText) {
        // Clear the context for the full chapter only if the full chapter is being generated.
        await memory.saveContext(
          { input: `Start of Chapter ${promptData.chapterNo}` },
          { output: "" }
        );
        console.log(`Memory cleared for Chapter ${promptData.chapterNo}`);
      }

      // Step 2: Regenerate paragraph (if 'selectedText' is present) with or without instruction
      if (promptData.selectedText) {
        const isHeading = (text) => {
          const lines = text.split('\n').filter(line => line.trim() !== '');
          return lines.length === 1 && text.length <= 100 && !/[.!?]$/.test(text.trim());
        };

        const headingCheck = isHeading(promptData.selectedText);

        if (headingCheck) {
          // Handle heading improvement
          if (promptData.instruction) {
            updatePrompt = `
              You are an expert book writer. Improve the following heading of the book "${bookInfo.bookTitle}" while maintaining its context and coherence:
              
              **Original Heading:**
              "${promptData.selectedText}"
              **Instructions:**
              ${promptData.instruction}
              **Guidelines:**
              - Enhance clarity and conciseness.
              - Maintain the same context and meaning.
              - Keep it as a heading; do not generate a paragraph.
              - Ensure it is engaging and appropriately styled.
              
              **Improved Heading (do not enclose in quotes):**
            `;
            const memoryVariables = await memory.loadMemoryVariables({});
            if (memoryVariables?.history) {
              updatePrompt += `
                **Previous Chapter Context:**
                ${memoryVariables.history}
              `;
            }
          } else {
            updatePrompt = `
              You are an expert book writer. Improve the following heading of the book "${bookInfo.bookTitle}" while maintaining its context and coherence:
              
              **Original Heading:**
              ${promptData.selectedText}
              
              **Guidelines:**
              - Enhance clarity and conciseness.
              - Maintain the same context and meaning.
              - Keep it as a heading; do not generate a paragraph.
              - Ensure it is engaging and appropriately styled.
              
              **Improved Heading (do not enclose in quotes):**
            `;
          }
        } else {
          // Handle paragraph improvement (original code)
          if (promptData.instruction) {
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
            const memoryVariables = await memory.loadMemoryVariables({});
            if (memoryVariables?.history) {
              updatePrompt += `
                **Previous Chapter Context:**
                ${memoryVariables.history}
              `;
            }
          } else {
            updatePrompt = `
              You are an expert book writer. Improve the following paragraph of the book "${bookInfo.bookTitle}" while maintaining its context and coherence:
              
              **Original Paragraph:**
              "${promptData.selectedText}"
              
              **Guidelines:**
              - Enhance the clarity and flow.
              - Maintain the same context and meaning.
              - Avoid generating completely new or irrelevant content.
              - Keep it engaging and refined.
              
              **Improved Paragraph (do not enclose in quotes):**
            `;
          }
        }


        let updateResponse = await this.textModel.stream(updatePrompt);
        let updatedText = "";
        let finalResult: AIMessageChunk | undefined;

        for await (const chunk of updateResponse) {
          if (finalResult) {
            finalResult = concat(finalResult, chunk);
          } else {
            finalResult = chunk;
          }
          updatedText += chunk.content;
          onTextUpdate(chunk.content);
        }
        if (this.userInfo.role === UserRole.USER) {
          const { totalTokens } = await this.getUsage(finalResult)
          await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
          await this.subscriptionService.trackTokenUsage(userId, "chapterParagraphRegenerate", UsageType.TOKEN, { chapterParagraphRegenerate: totalTokens });
        }
        // Save the updated context for this paragraph only, not clearing the whole chapter.
        await memory.saveContext(
          { input: promptData.selectedText },
          { output: updatedText }
        );

        return updatedText;
      } else {

        // Step 3: Generate the Chapter Text (Chunked or Full)

        // If we have images, we generate in chunks: Text -> Image -> Text -> Image -> Final Text
        if (promptData.noOfImages > 0) {
          let fullChapterContent = "";

          // We will generate N chunks of text followed by N images, then 1 final chunk.
          // So loop N times.
          for (let i = 1; i <= promptData.noOfImages; i++) {

            // A. Generate Text Section
            const partPrompt = `
              You are a professional author writing ** Chapter ${promptData.chapterNo}: "${promptData.chapterName}" **.
              
              Current Task: Write ** Part ${i}** of the chapter.
              This section should naturally flow into a visual scene.
              
              ** Instructions:**
              - Write a substantial section of the chapter(approx ${(promptData.maxWords || 5000) / (promptData.noOfImages + 1)} words).
          - Advance the plot / content logically.
              - ** End this section with a scene or concept that is highly visual **.
              - Do NOT finish the chapter yet(unless this is the very last part).
              - ** STRICTLY FORBIDDEN:** Do NOT write "Image #1", "Image Description", or any meta - text describing illustrations.Write ONLY the story text.
              
              ** Style & Tone:**
            - Genre: ${bookInfo.genre}
          - Tone: Consistent with the book.
              
              ** Context:**
            ${await memory.loadMemoryVariables({})}
          `;

            const partStream = await this.textModel.stream(partPrompt);
            let partText = "";
            let partResult: AIMessageChunk | undefined;

            for await (const chunk of partStream) {
              if (partResult) partResult = concat(partResult, chunk);
              else partResult = chunk;

              partText += chunk.content;
              onTextUpdate(chunk.content); // Stream text to user
            }
            fullChapterContent += partText;

            // Track Usage
            if (this.userInfo.role === UserRole.USER) {
              const { totalTokens } = await this.getUsage(partResult);
              await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens, 0);
              await this.subscriptionService.trackTokenUsage(userId, "generateChapterPart", UsageType.TOKEN, { generateChapterPart: totalTokens }, bookInfo, promptData.chapterNo);
            }

            if (!partText.trim()) continue; // Skip if empty

            // Update Memory with this part
            await memory.saveContext(
              { input: `Write Part ${i} of Chapter ${promptData.chapterNo} ` },
              { output: partText }
            );


            // B. Generate Image for this Section
            // 1. Extract Key Point
            const keyPointPrompt = `
              Based on the following text section, identify ** ONE ** single, vivid, and specific visual scene or concept that best represents it for an illustration.
              Return ONLY the short description(1 sentence).

            Text:
              ${partText}
            
            STRICT RULES:
              - Must be a PHYSICAL VISUAL SCENE (objects, people, places).
              - IGNORE metaphors, thoughts, and feelings.
              - If the text is dialogue, describe the SETTING.
              - Ensure the scene is strictly related to the main subject of the book: "${bookInfo.bookTitle}".
              - DO NOT include elements from other domains (e.g., do not show basketball/football if the book is about Cricket/Sachin) unless explicitly central to the scene.
          `;
            const keyPointResponse = await this.textModel.invoke(keyPointPrompt);
            const keyPoint = keyPointResponse.content.trim();

            // Track Usage (KeyPoint)
            if (this.userInfo.role === UserRole.USER) {
              const { totalTokens } = await this.getUsage(keyPointResponse);
              await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
            }

            // 2. Generate Image
            const imagePrompt = `
              Create a high - quality illustration for:
            - Book: "${bookInfo.bookTitle}" (Genre: ${bookInfo.genre})
            - Core Concept: "${bookInfo.ideaCore || bookInfo.bookTitle}"
              - Chapter: ${promptData.chapterNo}
          - Scene: "${keyPoint}"
            - Style: "${this.settingPrompt.chapterImagePrompt}"
              - Target Audience: "${bookInfo.targetAudience}"
              ${promptData.imagePrompt ? `- Additional Guidance: "${promptData.imagePrompt}"` : ""}
              
              Make it visually striking and contextually accurate.
            `;

            let imageUrl: string | null = null;
            try {
              const postResponse = await axios.post(
                this.userInfo.role === UserRole.USER ? this.userKeyRecord.package ? this.userKeyRecord?.package.imageModelURL : this.settingPrompt.coverImageDomainUrl : this.settingPrompt.coverImageDomainUrl ?? this.configService.get<string>("BASE_URL_FAL_AI"),
                { prompt: imagePrompt },
                {
                  headers: {
                    Authorization: `Key ${this.apiKeyRecord.fal_ai} `,
                    "Content-Type": "application/json",
                  },
                }
              );

              // Poll for image
              const imageResponseUrl = postResponse.data.response_url;

              // Poll logic inline here or call helper
              // We'll reuse the helper logic but adapted for single image return to stream
              // For simplicity reusing pollImageGeneration is hard because it updates an array by reference.
              // Let's copy-paste a simplified poll/save here to stream directly.

              const maxRetries = 60;
              const delayMs = 2000;
              let attempt = 0;

              while (attempt < maxRetries) {
                try {
                  const getRes = await axios.get(imageResponseUrl, { headers: { Authorization: `Key ${this.apiKeyRecord.fal_ai} ` } });
                  if (getRes.data.images?.length > 0) {
                    imageUrl = getRes.data.images[0].url;
                    break;
                  }
                  // Check for fallback
                  if (getRes.data?.detail?.includes("Exhausted balance")) throw new Error("Exhausted balance");

                } catch (e) {
                  // swallow poll error 
                }
                await new Promise(r => setTimeout(r, delayMs));
                attempt++;
              }

              // Fallback if failed
              if (!imageUrl) {
                const fallbackUrl = this.configService.get<string>("FALLBACK_IMAGE_URL");
                if (fallbackUrl) imageUrl = fallbackUrl;
              }

              if (imageUrl) {
                // Save it locally
                const savedPath = await this.saveGeneratedImage(imageUrl, bookInfo.bookTitle, userId);

                // Stream Image Markdown immediately!
                const imageMarkdown = `\n\n![${keyPoint}](${savedPath}) \n\n`;
                fullChapterContent += imageMarkdown;
                onTextUpdate(imageMarkdown);

                if (this.userInfo.role === UserRole.USER) {
                  await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, 0, 1);
                  await this.subscriptionService.trackTokenUsage(userId, "chapterImage", UsageType.IMAGE, { chapterImage: savedPath }, bookInfo, promptData.chapterNo);
                }
              }

            } catch (err) {
              console.error("Failed to generate inline image:", err);
              // Continue without image if failed
            }
          } // End Loop

          // C. Generate Final Conclusion Section
          const finalPrompt = `
              You are a professional author writing ** Chapter ${promptData.chapterNo}: "${promptData.chapterName}" **.
              
              Current Task: Write the ** Final Part ** (Conclusion) of this chapter.
              
              ** Instructions:**
            - Wrap up the events of this chapter.
              - Provide a satisfying conclusion to the chapter's arc.
            - Set up hooks or transitions for the next chapter.
              
               ** Context:**
              ${await memory.loadMemoryVariables({})}

              ** STRICT OUTPUT RULES:**
              - ** Do NOT ** output apologies(e.g., "I'm sorry", "I cannot").
              - ** Do NOT ** output meta - commentary(e.g., "Here is the conclusion", "Feel free to modify").
              - ** Do NOT ** mention missing context.If context is missing, improvise a suitable ending based on the Chapter Title.
              - Output ** ONLY ** the story content.
            `;

          const finalStream = await this.textModel.stream(finalPrompt);
          let finalText = "";
          let finalResult: AIMessageChunk | undefined;

          for await (const chunk of finalStream) {
            if (finalResult) finalResult = concat(finalResult, chunk);
            else finalResult = chunk;
            finalText += chunk.content;
            onTextUpdate(chunk.content);
          }
          fullChapterContent += finalText;

          // Track Usage (Final)
          if (this.userInfo.role === UserRole.USER) {
            const { totalTokens } = await this.getUsage(finalResult);
            await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens, 0);
            await this.subscriptionService.trackTokenUsage(userId, "generateChapterPart", UsageType.TOKEN, { generateChapterPart: totalTokens }, bookInfo, promptData.chapterNo);
          }

          await memory.saveContext(
            { input: `Write Conclusion of Chapter ${promptData.chapterNo} ` },
            { output: finalText }
          );

          return fullChapterContent;

        } else {

          // EXISTING LOGIC FOR NO IMAGES
          const chapterPrompt = `
          You are a professional author tasked with writing ** Chapter ${promptData.chapterNo}: "${promptData.chapterName}" ** of the book titled ** "${bookInfo.bookTitle}" **.
    
          ## 📖 Book Information:
          - ** Genre **: ${bookInfo.genre}
          - ** Author **: ${bookInfo.authorName || "A knowledgeable expert"}
          - ** Core Idea **: ${bookInfo.ideaCore || "A detailed and insightful book on the subject."}
          - ** Target Audience **: ${bookInfo.targetAudience || "Professionals, students, and knowledge seekers."}
          - ** Language **: The book is written in ${bookInfo.language || "English"}.
          ## 🎯 Writing Style:
          - Clearly structure the content using Markdown:
            Based on the genre ** "${bookInfo.genre}" **, adopt an appropriate writing style.
          - Use a ** tone ** and ** structure ** that aligns with the genre.
  - Adapt the complexity and depth based on the ** target audience **.
  - Organize the content with clear section headings(# Heading) and subheadings(## Subheading) throughout the chapter.
  - Each major concept, theme, or section should have its own heading.
  - Use headings to create a logical flow and hierarchy of information.
  
          ## 📝 Context Memory(Summarized Previous Chapters):
          ${await memory.loadMemoryVariables({})}
    
          ## 📖 Chapter Writing Instructions:
          - Begin with a ** strong introduction ** that aligns with the book's theme.
            - ** Your writing must contain between ${promptData.minWords || 5000} and ${promptData.maxWords || 20000} words **.
          - ** DO NOT ** generate content below the minimum word count.
          - ** DO NOT ** exceed the maximum word count.
     - ** IMPORTANT **: Structure the chapter with appropriate headings and subheadings that guide the reader through the content.

          ## 🔍 Additional Guidance:
          ${promptData.additionalInfo || "Follow the established style, tone, and pacing from previous chapters."}

          ---
        
          ** STRICT OUTPUT RULES:**
          - ** Do NOT ** output apologies(e.g., "I'm sorry").
          - ** Do NOT ** output meta - commentary(e.g., "Here is the chapter").
          - Output ** ONLY ** the story content.

          **📝 Begin Chapter ${promptData.chapterNo}:**
          ** Always return chapter content in Paragraph format **
          ** Chapter Name show in heading format **
            `;

          const stream = await this.textModel.stream(chapterPrompt);
          let chapterText = "";
          const chunks = [];
          let finalResult: AIMessageChunk | undefined;

          for await (const chunk of stream) {
            chunks.push(chunk);
            chapterText += chunk.content;
            if (finalResult) {
              finalResult = concat(finalResult, chunk);
            } else {
              finalResult = chunk;
            }
            onTextUpdate(chunk.content);
          }
          if (this.userInfo.role === UserRole.USER) {
            const { totalTokens } = await this.getUsage(finalResult)
            await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens, promptData.noOfImages);
            await this.subscriptionService.trackTokenUsage(userId, "generateChapter", UsageType.TOKEN, { generateChapter: totalTokens }, bookInfo, promptData.chapterNo);
          }
          if (!chapterText.trim()) {
            throw new Error(`Chapter ${promptData.chapterNo} content is empty.`);
          }

          // Save memory
          await memory.saveContext(
            { input: `Start of Chapter ${promptData.chapterNo} ` },
            { output: chapterText }
          );

          return chapterText;
        }
      }
    } catch (error) {
      console.error("Error generating chapter content:", error);
      throw new Error(error.message);
    }
  }




  async generateChapterOfBook(
    input: BookChapterGenerationDto,
    userId: number,
    onTextUpdate: (text: string) => void
  ) {
    try {
      let chapterSummaryResponse: string;

      await this.initializeAIModels(userId, input.noOfImages);

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
        !!bookChapter,
        userId,
        onTextUpdate
      );

      if (!input.selectedText) {
        chapterSummaryResponse =
          await this.generateChapterSummary(formattedChapter, bookInfo, userId);
      }
      if (input.selectedText || input.instruction) {
        return formattedChapter;
      }

      if (bookChapter) {
        // If chapter exists, update it
        bookChapter.chapterInfo = formattedChapter;
        bookChapter.maxWords = input.maxWords;
        bookChapter.minWords = input.minWords;
        bookChapter.chapterSummary = chapterSummaryResponse;
      } else {
        // If chapter does not exist, create a new record
        bookChapter = new BookChapter();
        bookChapter.bookGeneration = bookInfo;
        bookChapter.chapterNo = input.chapterNo;
        bookChapter.chapterInfo = formattedChapter;
        bookChapter.maxWords = input.maxWords;
        bookChapter.minWords = input.minWords;
        bookChapter.chapterSummary = chapterSummaryResponse;
        bookChapter.chapterName = input.chapterName;
      }
      // Save (either insert or update)
      const savedChapter = await this.bookChapterRepository.save(bookChapter);
      if (this.userInfo.role === UserRole.USER) {
        await this.subscriptionService.updateTrackTokenUsage(this.userInfo, this.userKeyRecord?.package ?? null, bookInfo, input.chapterNo)
      }

      return savedChapter;
    } catch (error) {
      console.error("Error generating book chapter:", error);
      throw new Error(error.message);
    }
  }
  async updateChapter(input: BookChapterUpdateDto, userId: number) {
    try {
      await this.initializeAIModels(userId);

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
      bookChapter.chapterInfo = input.updateContent;
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

  async generateChapterSummaries(
    summaryRequest: BookChapterDto,
    userId,
    onTextUpdate: (text: string) => void
  ) {
    try {
      await this.initializeAIModels(userId);

      // Validate book exists
      const bookInfo = await this.bookGenerationRepository.findOne({
        where: { id: summaryRequest.bookId },
      });

      if (!bookInfo) {
        throw new Error(
          `Book generation record not found for id: ${summaryRequest.bookId} `
        );
      }

      // First, fetch all chapters to sort them properly
      const chapters = await Promise.all(
        summaryRequest.chapterIds.map((chapterId) =>
          this.bookChapterRepository.findOne({
            where: {
              id: chapterId,
              bookGeneration: { id: summaryRequest.bookId },
            },
          })
        )
      );

      // Filter out any nulls and sort by chapter number
      const validChapters = chapters
        .filter((chapter) => chapter !== null)
        .sort((a, b) => (a.chapterNo || 0) - (b.chapterNo || 0));

      if (validChapters.length === 0) {
        onTextUpdate(`No valid chapters found for the provided chapter IDs.`);
        return;
      }

      // If isCombined is true, combine all chapter contents into one string
      if (summaryRequest.isCombined) {
        let combinedText = "";
        for (const chapter of validChapters) {
          combinedText += `${chapter.chapterInfo} \n\n`;
        }

        // Use master prompt if available, otherwise use default
        let summaryPrompt = this.settingPrompt.chapterSummaryMasterPrompt
          ? this.settingPrompt.chapterSummaryMasterPrompt
            .replace('${noOfWords}', summaryRequest.noOfWords.toString())
            .replace('${chapterContent}', combinedText)
          : `
            You are creating a concise, engaging summary for the entire book "${bookInfo.bookTitle}".
      
            Combined Content of All Chapters:
            ${combinedText}

          Instructions:
          1. Write exactly ${summaryRequest.noOfWords} words well - crafted sentences that capture the essence of the entire book.
            2. Include the most significant plot points, character developments, or key concepts.
            3. Use vivid, engaging language that captures the tone of the original text.
            4. Make the summary flow naturally from sentence to sentence.
      
            Proceed with your ${summaryRequest.noOfWords} words sentence summary.
            Do not use bullet points or include any other text beyond the summary itself.
          `;

        // Stream the summary generation
        const stream = await this.textModel.stream(summaryPrompt);

        let finalSummary = "";
        let finalResult: AIMessageChunk | undefined;
        for await (const chunk of stream) {
          if (finalResult) {
            finalResult = concat(finalResult, chunk);
          } else {
            finalResult = chunk;
          }
          finalSummary += chunk.content;
          onTextUpdate(chunk.content);
        }

        if (this.userInfo.role === UserRole.USER) {
          const { totalTokens } = await this.getUsage(finalResult)
          await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
          await this.subscriptionService.trackTokenUsage(userId, "chapterSummary", UsageType.TOKEN, { chapterSummary: totalTokens });
        }

      } else {
        // If isCombined is false, generate chapter-wise summaries
        for (const chapter of validChapters) {
          try {
            const chapterText = chapter.chapterInfo;

            // Use master prompt if available, otherwise use default
            let chapterSummaryPrompt = this.settingPrompt.chapterSummaryMasterPrompt
              ? this.settingPrompt.chapterSummaryMasterPrompt
                .replace('${noOfWords}', summaryRequest.noOfWords.toString())
                .replace('${chapterContent}', chapterText)
              : `
                You are creating a concise, engaging summary 
                Chapter Content:
                ${chapterText}

          Instructions:
          1. Write exactly ${summaryRequest.noOfWords} words well - crafted sentences that capture the essence of this chapter.
                2. Include the most significant plot points, character developments, or key concepts from this chapter.
                3. Use vivid, engaging language that captures the tone of the original text.
                4. Make the summary flow naturally from sentence to sentence.
        
                Proceed with your ${summaryRequest.noOfWords} words sentence summary for this chapter.
                Do not use bullet points or include any other text beyond the summary itself.
                Do not include chapter name and chapter number
              `;

            const stream = await this.textModel.invoke(chapterSummaryPrompt);
            onTextUpdate(stream.content)
            if (this.userInfo.role === UserRole.USER) {
              const { totalTokens } = await this.getUsage(stream)
              await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
              await this.subscriptionService.trackTokenUsage(userId, "chapterSummary", UsageType.TOKEN, { chapterSummary: totalTokens });
            }

          } catch (error) {
            onTextUpdate(`Error generating summary for Chapter ${chapter.chapterNo}: ${error.message} `);
            this.logger.error(`Error generating chapter summary for Chapter ${chapter.chapterNo}: `, error);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error in generateChapterSummaries: `, error);
      throw new Error(`Failed to generate chapter summaries: ${error.message} `);
    }
  }


  async generateChapterSlides(
    bookId: number,
    chapterIds: number[],
    numberOfSlides: number,
    userId: number,
    onTextUpdate: (text: string) => void
  ) {
    try {
      await this.initializeAIModels(userId);

      const bookInfo = await this.bookGenerationRepository.findOne({
        where: { id: bookId },
      });

      if (!bookInfo) {
        throw new Error(`Book generation record not found for id: ${bookId} `);
      }

      for (const chapterId of chapterIds) {
        try {
          const chapter = await this.bookChapterRepository.findOne({
            where: { id: chapterId, bookGeneration: { id: bookId } },
          });

          if (!chapter) {
            onTextUpdate(`Chapter ID ${chapterId} not found for this book.Skipping.`);
            continue;
          }

          const chapterText = chapter.chapterInfo;

          // Use master prompt if available, otherwise use default
          let slidePrompt = this.settingPrompt.presentationSlidesMasterPrompt
            ? this.settingPrompt.presentationSlidesMasterPrompt
              .replace('${numberOfSlides}', numberOfSlides.toString())
              .replace('${chapterContent}', chapterText)
            : `
              Create exactly ${numberOfSlides} presentation slides for the following chapter content:
              
              Chapter Text:
              ${chapterText}

          Requirements:
          - Create exactly ${numberOfSlides} slides
            - Each slide should have a clear title and bullet points
              - Keep content concise and focused
                - Use markdown format for slides
                  - Format each slide as:
                # Slide Title
            - Bullet point 1
              - Bullet point 2
                - Bullet point 3
              
              Generate ${numberOfSlides} slides now:
          `;

          const stream = await this.textModel.invoke(slidePrompt);

          if (this.userInfo.role === UserRole.USER) {
            const { totalTokens } = await this.getUsage(stream)
            await this.subscriptionService.updateSubscription(userId, this.userKeyRecord?.package?.id ?? null, totalTokens);
            await this.subscriptionService.trackTokenUsage(userId, "chapterSlides", UsageType.TOKEN, { chapterSlides: totalTokens });
          }
          return stream.content;
        } catch (error) {
          onTextUpdate(`\n\nError generating slides for Chapter ID ${chapterId}: ${error.message} \n\n`);
          this.logger.error(`Error generating slides for Chapter ID ${chapterId}: `, error);
        }
      }

      onTextUpdate(`\n\n## All slides completed\n\n`);
    } catch (error) {
      this.logger.error(`Error in generateChapterSlides: `, error);
      throw new Error(`Failed to generate chapter slides: ${error.message} `);
    }
  }
  public async getUsage(response, inputText?: string): Promise<{ inputTokens: number, outputTokens: number, totalTokens: number }> {
    // Get output tokens from response
    const outputTokens = response?.usage_metadata?.total_tokens !== undefined
      ? response.usage_metadata.total_tokens
      : (response?.content?.length ? Math.ceil(response.content.length / 4) : 0);

    // Estimate input tokens if inputText is provided
    const inputTokens = inputText
      ? Math.ceil(inputText.length / 4) // Simple approximation of token count
      : 0;

    // Calculate total tokens (input + output)
    const totalTokens = inputTokens + outputTokens;

    return { inputTokens, outputTokens, totalTokens };

  }
}
