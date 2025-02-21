import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AiAssistant, AiAssistantType } from "./entities/ai-assistant.entity";
import { ChatOpenAI, OpenAI } from "@langchain/openai";
import { ApiKeysService } from "src/api-keys/api-keys.service";
import { AiAssistantDto, StoryDTO } from "./dto/ai-assistant.dto";
import { UsersService } from "src/users/users.service";

@Injectable()
export class AiAssistantService {
  private readonly model: OpenAI;
 private textModel;
  private apiKeyRecord;
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly uploadsDir: string;
  constructor(
    @InjectRepository(AiAssistant)
    private readonly aiAssistantRepository: Repository<AiAssistant>,
    private readonly apiKeyService: ApiKeysService,
    private readonly usersService: UsersService,
    
  ) {
    
   
  }


   private async initializeAIModels() {
      try {
        this.apiKeyRecord = await this.apiKeyService.getApiKeys();
        if (!this.apiKeyRecord) {
          throw new Error("No API keys found in the database.");
        }
  
        this.textModel = new ChatOpenAI({
          openAIApiKey: this.apiKeyRecord.openai_key,
          temperature: 0.7,
          modelName: this.apiKeyRecord.model,
        });
        
      } catch (error) {
        this.logger.error(`Failed to initialize AI models: ${error.message}`);
        throw new Error("Failed to initialize AI models.");
      }
    }

    async processAiAssistantTask(userId: number, input: AiAssistantDto): Promise<AiAssistant> {
      await this.initializeAIModels();
      
      const user = await this.usersService.getProfile(userId);
      const aiAssistant = new AiAssistant();
  
      if (!input || !input.type) {
          throw new Error("Invalid AI Assistant task.");
      }
  
      let prompt: string;
  
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
              prompt = this.generatePrompt(input.type, input.bookCoverInfo);
              aiAssistant.information = input.bookCoverInfo; // Store book cover details
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
      const response = await this.textModel.invoke(prompt);
  
      // ✅ Store AI response in the database
      aiAssistant.type = input.type;
      aiAssistant.user = user;
      aiAssistant.response = {
          generatedText: response.content,
          timestamp: new Date(),
      };
  
      const aiAssistantDetail = await this.aiAssistantRepository.save(aiAssistant);
      return aiAssistantDetail;
  }
  

  private generatePrompt(type: AiAssistantType, info: Record<string, any>): string {
    switch (type) {
      case AiAssistantType.BOOK_IDEA:
        return `Generate a compelling and unique **core idea** for a book based on the following details:
          
        - **Genre**: ${info?.genre || "Any"}
        - **Theme or Topic**: ${info?.themeOrTopic || "Innovative, insightful, and thought-provoking"}
        - **Target Audience**: ${info?.targetAudience || "All age groups"}
        - **Key Elements**: ${info?.specificElements || "Visionary concepts, human creativity, or breakthrough ideas"}
        - **Writing Style**: ${info?.writingStyle || "Engaging, immersive, and intellectually stimulating"}
        - **Description**: ${info?.description || "Develop a powerful and insightful book concept that explores impactful ideas and real-world transformations."}
        
        ### **Expected Output Format**
        - **Book Title**: A compelling title that reflects the book's concept.
        - **Core Idea**: A well-defined and thought-provoking explanation of what the book is about, including its impact, purpose, and key message.
        
        The response should be **concise, profound, and engaging**, capturing the essence of the book in a way that excites potential readers and publishers.`;
        
        case AiAssistantType.BOOK_COVER_IMAGE:
          return `### Book Cover Design Brief Prompt:

          **Book Title**: "${info?.bookTitle || "Untitled"}"  
          **Genre**: ${info?.genre || "General"}  
          **Target Audience**: ${info?.targetAudience || "All Ages"}  
          **Cover Style**: ${info?.coverStyle || "Illustrated"}  
          **Color Theme**: ${info?.colorPreference || "Dark and moody tones"}  
          **Additional Design Notes**: ${info?.additionalElements || "Subtle business-related icons for a sleek finish"}  
          `;
          
      
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
