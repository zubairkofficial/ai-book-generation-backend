import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { _ } from "lodash";
import { AiAssistant, AiAssistantType } from "./entities/ai-assistant.entity";
import { ChatOpenAI, OpenAI } from "@langchain/openai";
import { AiAssistantDto, AiAssistantMessage } from "./dto/ai-assistant.dto";
import { UsersService } from "src/users/users.service";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { SettingsService } from "src/settings/settings.service";
import { BookChapterService } from "src/book-chapter/book-chapter.service";
import { SubscriptionService } from "src/subscription/subscription.service";
import { UsageType } from "src/subscription/entities/usage.entity";
import { User, UserRole } from "src/users/entities/user.entity";
import { ApiKey } from "src/api-keys/entities/api-key.entity";
@Injectable()
export class AiAssistantService {
  private readonly model: OpenAI;
  private settingPrompt;
  private textModel;
  private userKeyRecord;
  private apiKeyRecord;
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly uploadsDir: string;
  private openai: OpenAI;
  private userInfo;
  constructor(
    @InjectRepository(AiAssistant)
    private readonly aiAssistantRepository: Repository<AiAssistant>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly bookChapterService: BookChapterService,
    private readonly subscriptionService: SubscriptionService,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,


  ) {
    this.uploadsDir = this.setupUploadsDirectory();
  }


  private setupUploadsDirectory(): string {
    const rootDir = process.cwd();
    const uploadsPath = path.join(rootDir, "uploads", "covers");

    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }
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

  private selectModelName(): string {
    const isAdmin = this.userInfo.role === UserRole.ADMIN;
    const hasNoPackage = !this.userKeyRecord?.package;

    return (isAdmin || hasNoPackage)
      ? this.apiKeyRecord.modelType
      : this.userKeyRecord.package.modelType;
  }



  private async initializeAIModels(userId: number, noOfImages?: number) {
    try {
      // Fetch user profile
      this.userInfo = await this.usersService.getProfile(userId);
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
      });

      this.logger.log(`AI Models initialized successfully with model: ${this.selectModelName()}`);
    } catch (error) {
      this.logger.error(`Failed to initialize AI models: ${error.message}`);
      throw new Error(error.message);
    }
  }


  private async pollImageGeneration(responseUrl: string, bookTitle: string): Promise<string> {
    const maxRetries = 12;
    const delayMs = 10000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const getResponse = await axios.get(responseUrl, {
          headers: {
            Authorization: `Key ${this.apiKeyRecord.fal_ai}`,
            "Content-Type": "application/json",
          },
        });

        if (getResponse.data.images?.length > 0) {
          return this.saveGeneratedImage(
            getResponse.data.images[0].url,
            bookTitle
          );
        }
      } catch (error) {
        this.logger.warn(`Image not ready (Attempt ${attempt + 1}/${maxRetries})`);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error("Image generation timed out.");
  }


  private async generateCoverImage(prompt: string, bookTitle: string, user: User): Promise<string> {
    try {
      const requestData = {
        prompt,
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: "2",
        output_format: "jpeg",
        aspect_ratio: "9:16",
        raw: false,
      };

      const postResponse = await axios.post(
        //  user.role===UserRole.USER?!this.userKeyRecord.package?this.settingPrompt.coverImageDomainUrl: this.userKeyRecord?.package?.imageModelURL : this.settingPrompt.coverImageDomainUrl ??  this.configService.get<string>("BASE_URL_FAL_AI"),
        this.configService.get<string>("BASE_URL_FAL_AI"),

        // "https://queue.fal.run/fal-ai/ideogram/v2",
        requestData,
        {
          headers: {
            Authorization: `Key ${this.apiKeyRecord.fal_ai}`,
            "Content-Type": "application/json",
          },
        }
      );

      return this.pollImageGeneration(
        postResponse.data.response_url,
        bookTitle
      );
    } catch (error) {
      this.logger.error(`Image generation failed: ${error.message}`);
      throw new Error(error.message);
    }
  }

  private async saveGeneratedImage(imageUrl: string, bookTitle: string): Promise<string> {
    const dirPath = this.uploadsDir;
    const baseUrl = this.configService.get<string>("BASE_URL");
    const sanitizedTitle = bookTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${sanitizedTitle}_${Date.now()}.png`;
    const imagePath = path.join(dirPath, filename);

    try {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(imagePath, response.data);
      return `${baseUrl}/uploads/covers/${filename}`;
    } catch (error) {
      this.logger.error(`Failed to save image: ${error.message}`);
      throw new Error("Failed to save generated image");
    }
  }


  async processAiAssistantTask(userId: number, input: AiAssistantDto): Promise<AiAssistant> {
    try {
      const noOfImages = input.type === AiAssistantType.BOOK_COVER_IMAGE && input.bookCoverInfo.numberOfImages
      await this.initializeAIModels(userId, +noOfImages);

      const user = await this.usersService.getProfile(userId);
      const aiAssistant = new AiAssistant();

      if (!input || !input.type) {
        throw new Error("Invalid AI Assistant task.");
      }

      let prompt: string;
      let imageUrls: string[] = [];


      // ✅ Handle different AI assistant types
      switch (input.type) {
        case AiAssistantType.BOOK_IDEA:
          if (!input.information) {
            throw new Error("Missing required information for BOOK_IDEA.");
          }
          prompt = this.generatePrompt(input.type, input.information);
          aiAssistant.information = input.information;
          break;

        case AiAssistantType.BOOK_COVER_IMAGE:
          if (!input.bookCoverInfo) {
            throw new Error("Missing required information for BOOK_COVER_IMAGE.");
          }

          // Generate cover images
          const numberOfImages = input.bookCoverInfo.numberOfImages || 1;
          prompt = this.generatePrompt(input.type, input.bookCoverInfo);

          // Generate multiple images
          for (let i = 0; i < Number(numberOfImages); i++) {
            try {
              const imageUrl = await this.generateCoverImage(
                prompt,
                input.bookCoverInfo.bookTitle,
                user
              );
              if (this.userInfo.role === UserRole.USER) {
                await this.subscriptionService.updateSubscription(user.id, this.userKeyRecord.package?.id ?? null, 0, 4);
                await this.subscriptionService.trackTokenUsage(user.id, input.bookCoverInfo.bookTitle, UsageType.IMAGE, { aiAssistantCoverImage: imageUrl });
              }
              imageUrls.push(imageUrl);
            } catch (error) {
              this.logger.error(`Failed to generate image ${i + 1}: ${error.message}`);
              throw new Error(error.message)
            }
          }

          aiAssistant.information = input.bookCoverInfo;
          break;

        case AiAssistantType.WRITING_ASSISTANT:
          if (!input.bookWriteInfo) {
            throw new Error("Missing required Information for WRITING_ASSISTANT.");
          }
          prompt = this.generatePrompt(input.type, input.bookWriteInfo);
          aiAssistant.information = input.bookWriteInfo;
          break;

        default:
          throw new Error(`Unsupported AI Assistant type: ${input.type}`);
      }

      // ✅ Generate AI response
      if (input.type !== AiAssistantType.BOOK_COVER_IMAGE) {
        const response = await this.textModel.invoke(prompt);
        if (this.userInfo.role === UserRole.USER) {
          const { totalTokens } = await this.bookChapterService.getUsage(response);
          await this.subscriptionService.updateSubscription(user.id, this.userKeyRecord.package?.id ?? null, totalTokens);
          await this.subscriptionService.trackTokenUsage(user.id, _.camelCase(input.type), UsageType.TOKEN, { [_.camelCase(input.type)]: totalTokens });
        }
        // ✅ Store AI response in the database
        aiAssistant.type = input.type;
        aiAssistant.user = user;
        aiAssistant.response = {
          generatedText: response.content,
          timestamp: new Date(),
        };
      } else {
        aiAssistant.type = input.type;
        aiAssistant.user = user;
        aiAssistant.response = {
          imageUrls
        }
      }

      const aiAssistantDetail = await this.aiAssistantRepository.save(aiAssistant);
      return aiAssistantDetail;
    }
    catch (error) {
      throw new BadRequestException(error.message)
    }
  }
  async getAiAssistantChat(userId: number, input: AiAssistantMessage) {
    try {


      await this.initializeAIModels(userId);

      const user = await this.usersService.getProfile(userId);

      const aiAssistant = await this.aiAssistantRepository.findOne({
        where: { id: +input.aiAssistantId },
      });

      if (!aiAssistant) throw new NotFoundException('AI Assistant not found');

      const memory = new ConversationSummaryBufferMemory({
        llm: this.textModel,
      });

      if (aiAssistant.response?.generatedText) {
        await memory.saveContext(
          { input: 'previous response' },
          { output: aiAssistant.response.generatedText },
        );
      }

      await memory.saveContext({ input: input.message }, { output: '' });

      let prompt;

      switch (aiAssistant.type) {
        case AiAssistantType.BOOK_IDEA:
          prompt = this.messagePrompt(aiAssistant, input.message);
          break;

        case AiAssistantType.BOOK_COVER_IMAGE:
          prompt = this.messagePrompt(aiAssistant, input.message);
          break;

        case AiAssistantType.WRITING_ASSISTANT:
          prompt = this.messagePrompt(aiAssistant, input.message);
          break;

        default:
          throw new Error(`Unsupported AI Assistant type: ${aiAssistant.type}`);
      }

      const generatedResponse = await this.textModel.invoke(prompt + '\n' + input.message);

      // Save the new response in memory
      await memory.saveContext({ input: input.message }, { output: generatedResponse });



      return generatedResponse;
    } catch (error) {
      throw new InternalServerErrorException(error.message)
    }
  }

  messagePrompt(aiAssistant: AiAssistant, message: string): string {
    const previousResponse = aiAssistant.response?.generatedText
      ? `Previous response: ${aiAssistant.response.generatedText}\n`
      : '';

    switch (aiAssistant.type) {
      case AiAssistantType.BOOK_IDEA:
        return `${previousResponse}You're an AI specialized in suggesting innovative and engaging book ideas. Based on user input: ${message}`;

      case AiAssistantType.BOOK_COVER_IMAGE:
        return `${previousResponse}You're an AI specialized in describing creative book cover images. User description: ${message}`;

      case AiAssistantType.WRITING_ASSISTANT:
        return `${previousResponse}You're an AI writing assistant helping users to enhance their writing. User input: ${message}`;

      default:
        throw new Error(`Unsupported AI Assistant type: ${aiAssistant.type}`);
    }
  }

  private generatePrompt(type: AiAssistantType, info: Record<string, any>): string {
    // Check if master prompts exist and use them regardless of role
    switch (type) {
      case AiAssistantType.BOOK_IDEA:
        if (this.settingPrompt.bookIdeaMasterPrompt) {
          return this.settingPrompt.bookIdeaMasterPrompt
            .replace('${genre}', info?.genre || "Any")
            .replace('${themeOrTopic}', info?.themeOrTopic || "Innovative, insightful, and thought-provoking")
            .replace('${targetAudience}', info?.targetAudience || "All age groups")
            .replace('${description}', info?.description || "Develop a powerful and insightful book concept that explores impactful ideas and real-world transformations.");
        }
        // Fallback to default prompt if no master prompt exists
        return `Generate a compelling and unique **3-5 unique book concepts** **core idea** for a book based on the following details:
          
        - **Genre**: ${info?.genre || "Any"}
        - **Theme or Topic**: ${info?.themeOrTopic || "Innovative, insightful, and thought-provoking"}
        - **Target Audience**: ${info?.targetAudience || "All age groups"}
         - **Description**: ${info?.description || "Develop a powerful and insightful book concept that explores impactful ideas and real-world transformations."}
        
        ### **Expected Output Format**
        - **Book Title**: A compelling title that reflects the book's concept.
        - **Core Idea**: A well-defined and thought-provoking explanation of what the book is about, including its impact, purpose, and key message.
        
        The response should be **concise, profound, and engaging**, capturing the essence of the book in a way that excites potential readers and publishers.`;

      case AiAssistantType.BOOK_COVER_IMAGE:
        let finalPrompt = "";

        // Sanitization layer to strip "Prompt Injection" style instructions from data fields
        const sanitize = (text: string) => {
          if (!text) return text;
          return text
            .replace(/:\s*(include|make|add|show|put|generate|draw|with)\s+.*/gi, '') // Remove instructions after colon
            .replace(/(include|make|add|show|put|generate|draw)\s+.*\s+(on cover|in image|on image|to cover)/gi, '') // Remove common phrases
            .replace(/list of chapters|chapter list/gi, '') // Remove specific problematic phrases
            .trim();
        };

        const cleanTitle = sanitize(info?.bookTitle);
        const cleanSubtitle = sanitize(info?.subtitle);
        const cleanAuthor = sanitize(info?.authorName);

        if (this.settingPrompt.bookCoverMasterPrompt) {
          finalPrompt = this.settingPrompt.bookCoverMasterPrompt
            .replace('${bookTitle}', cleanTitle || "Untitled")
            .replace('${genre}', info?.genre || "")
            .replace('${targetAudience}', info?.targetAudience || "All Ages")
            .replace('${coreIdea}', info?.coreIdea || "Subtle business-related icons for a sleek finish")
            .replace('${systemPrompt}', this.settingPrompt.coverImagePrompt || "")
            .replace('${authorName}', cleanAuthor || "")
            .replace('${subtitle}', cleanSubtitle || "");
        } else {
          finalPrompt = `Design a visually striking and professional front cover as a standalone 2D graphic for the book titled "${cleanTitle}"
        - Visual Theme & Concept: ${info?.coreIdea}
        - Aesthetic Genre: ${info?.genre || ""}
        - Subtitle to include as text: ${cleanSubtitle || ""}
        - Author name to include as text: ${cleanAuthor || ""}
        - Target Audience Context: ${info?.targetAudience}
        - Style Requirements: ${this.settingPrompt.coverImagePrompt}`;
        }

        return finalPrompt + `
        
        STRICT RULES:
        1. Only render the literal text "${cleanTitle}", "${cleanSubtitle || ""}", and "${cleanAuthor || ""}" as readable text on the image.
        2. DO NOT render metadata labels (e.g., "Visual Theme", "Concept", "Aesthetic", "Core Idea", "Subtitle", "Author name") or any descriptive text about the book internal idea on the image.
        3. The descriptive info is for visual inspiration only, not for textual representation.
        `;
      // `Design a book front cover image 
      // - Book Titled "${info?.bookTitle || "Untitled"}". 
      // - Genre: ${info?.genre || "General"}
      // - **SubTitle**: ${info?.subtitle || ""}
      // - **Author**: ${info?.authorName || ""}
      // - Target Audience: ${info?.targetAudience || "All Ages"}
      // - Core Idea: ${info?.coreIdea || "Subtle business-related icons for a sleek finish"}
      // - **System Prompt**:${this.settingPrompt.coverImagePrompt}
      // The front cover should be visually engaging and appropriate for the target audience.`;

      case AiAssistantType.WRITING_ASSISTANT:
        if (this.settingPrompt.writingAssistantMasterPrompt) {
          return this.settingPrompt.writingAssistantMasterPrompt
            .replace('${genre}', info?.genre || "General")
            .replace('${writingGoal}', info?.writingGoal || "Improve writing quality")
            .replace('${writingLevel}', info?.writingLevel || "Beginner")
            .replace('${targetAudience}', info?.targetAudience || "All Ages")
            .replace('${specificArea}', info?.specificArea || "General storytelling")
            .replace('${currentChallenges}', info?.currentChallenges || "None specified");
        }
        // Fallback to default prompt
        return `### Writing Assistant: Expert Guidance

        Act as an **expert writing coach** and provide professional guidance for an author working on their book project.
        
        #### **Project Details**
        - **Genre**: ${info.genre || "General"}
        - **Writing Goal**: ${info.writingGoal || "Improve writing quality"}
        - **Writing Level**: ${info.writingLevel || "Beginner"}
        - **Target Audience**: ${info.targetAudience || "All Ages"}
        - **Specific Area**: ${info.specificArea || "General storytelling"}
        - **Current Challenges**: ${info.currentChallenges || "None specified"}
        
        ---
        
        ### **Generate 5 Expert Writing Tips**
        Based on the details provided, generate **5 expert-level writing tips** that are highly relevant to the genre, writing goal, and specific challenges.
        
        **Guidelines for the response:**
        - The tips should be **directly relevant** to the writing goal and specific area.
        - Ensure that the advice is **practical and actionable** for the given writing level.
        - Address the **challenges** mentioned while keeping in mind the **target audience**.
        - Use a **clear, professional tone** suitable for an aspiring or professional writer.
        - Provide **structured, numbered points** for clarity.
        
        Please provide the response in the format:
        
        1️⃣ **Tip 1 Title**  
           - Explanation of the tip.
        
        2️⃣ **Tip 2 Title**  
           - Explanation of the tip.
        
        3️⃣ **Tip 3 Title**  
           - Explanation of the tip.
        
        4️⃣ **Tip 4 Title**  
           - Explanation of the tip.
        
        5️⃣ **Tip 5 Title**  
           - Explanation of the tip.
        
        ---
        
        Ensure the output is **highly contextual and tailored** to the provided data without generic advice.`;

      default:
        throw new Error(`Unknown AI Assistant type: ${type}`);
    }
  }
}
