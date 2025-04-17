import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {_} from "lodash";
import { AiAssistant, AiAssistantType } from "./entities/ai-assistant.entity";
import { ChatOpenAI, OpenAI } from "@langchain/openai";
import { ApiKeysService } from "src/api-keys/api-keys.service";
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
import { UserRole } from "src/users/entities/user.entity";
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
    private readonly apiKeyService: ApiKeysService,
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
    private async initializeAIModels(userId:number) {
       try {
        let maxCompletionTokens:number
         this.userInfo=await this.usersService.getProfile(userId)
        if(!this.userInfo){
         throw new NotFoundException('user not exist')
       }
       
         this.apiKeyRecord = await this.apiKeyRepository.find();
         this.userKeyRecord = await this.subscriptionService.getUserActiveSubscription(userId);
         
         if (!this.apiKeyRecord) {
           throw new Error("No API keys found in the database.");
         }
         
         if(!this.userKeyRecord[0].package.imageModelURL||!this.userKeyRecord[0].package.modelType){
          throw new Error("Model type not exist");
         }
         this.settingPrompt = await this.settingsService.getAllSettings();
         if (!this.settingPrompt) {
           throw new Error("No setting prompt found in the database.");
         }
         if(this.userInfo.role===UserRole.USER) {
         // Calculate a reasonable maxTokens value
         const remainingTokens = this.userKeyRecord[0].package.tokenLimit - this.userKeyRecord[0].tokensUsed;
         if(remainingTokens===0)
           {
             throw new BadRequestException("Token limit exceeded")
           } 
         // Set a reasonable upper limit for completion tokens
          maxCompletionTokens = Math.min(remainingTokens, 4000); 
         }
         this.textModel = new ChatOpenAI({
           openAIApiKey: this.apiKeyRecord[0].openai_key,
           temperature: 0.4,
           modelName:this.userInfo.role===UserRole.ADMIN?this.apiKeyRecord[0].modelType :this.userKeyRecord[0].package.modelType,
           maxTokens: this.userInfo.role === UserRole.ADMIN ? undefined : maxCompletionTokens // Set maxTokens conditionally
   
         });
   
         this.logger.log(
           `AI Models initialized successfully with model: ${this.apiKeyRecord[0].model}`
         );
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
              Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
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


    private async generateCoverImage(prompt: string, bookTitle: string): Promise<string> {
      try {
        const requestData = { prompt ,
          num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: "2",
        output_format: "jpeg",
        aspect_ratio: "9:16",
        raw: false,
        };
        if(this.userKeyRecord[0].imagesGenerated >= this.userKeyRecord[0].package.imageLimit ){
          throw new UnauthorizedException("exceeded maximum image generation limit")
        }
        const postResponse = await axios.post(
          this.userInfo.role===UserRole.USER?this.userKeyRecord[0].package.imageModelURL  : this.settingPrompt.coverImageDomainUrl ??  this.configService.get<string>("BASE_URL_FAL_AI"),
          requestData,
          {
            headers: {
              Authorization: `Key ${this.apiKeyRecord[0].fal_ai}`,
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
     try{ 
      await this.initializeAIModels(userId);
      
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
                    input.bookCoverInfo.bookTitle
                  );
                  if(this.userInfo.role===UserRole.USER){ 
                  await this.subscriptionService.updateSubscription(user.id, this.userKeyRecord[0].package.id, 0,1);  
                  await this.subscriptionService.trackTokenUsage(user.id,input.bookCoverInfo.bookTitle,UsageType.IMAGE,{aiAssistantCoverImage:imageUrl});
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
   if(input.type!==AiAssistantType.BOOK_COVER_IMAGE) {
      const response = await this.textModel.invoke(prompt);
 if(this.userInfo.role===UserRole.USER){
      const totalTokens=await this.bookChapterService.getUsage(response)
      await this.subscriptionService.updateSubscription(user.id, this.userKeyRecord[0].package.id, totalTokens);  
      await this.subscriptionService.trackTokenUsage(user.id,_.camelCase(input.type),UsageType.TOKEN,{[_.camelCase(input.type)]:totalTokens});
       }
      // ✅ Store AI response in the database
      aiAssistant.type = input.type;
      aiAssistant.user = user;
      aiAssistant.response = {
          generatedText: response.content,
          timestamp: new Date(),
      };}else{
        aiAssistant.type = input.type;
        aiAssistant.user = user;
        aiAssistant.response={
         imageUrls
        }
      }
  
      const aiAssistantDetail = await this.aiAssistantRepository.save(aiAssistant);
      return aiAssistantDetail;
    }
      catch(error){
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
    switch (type) {
      case AiAssistantType.BOOK_IDEA:
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
          return `Design a book front cover image 
        - Book Titled "${info?.bookTitle || "Untitled"}". 
        - Genre: ${info?.genre || "General"}
        - Target Audience: ${info?.targetAudience || "All Ages"}
        - Core Idea: ${info?.coreIdea || "Subtle business-related icons for a sleek finish"}
        - **System Prompt**:${this.settingPrompt.coverImagePrompt}
        The front cover should be visually engaging and appropriate for the target audience.`;
          
      
      case AiAssistantType.WRITING_ASSISTANT:
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
