import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { SettingsService } from 'src/settings/settings.service';
import { UsersService } from 'src/users/users.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Settings } from 'src/settings/entities/settings.entity';
import { UserRole } from 'src/users/entities/user.entity';
import { UsageType } from 'src/subscription/entities/usage.entity';
import type { AIMessageChunk } from '@langchain/core/messages';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    private settingsService: SettingsService,
    private userService: UsersService,
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
  ) {}

  async initializeAIModel(userId: number, imageCount?: number) {
    try {
      let maxCompletionTokens: number;
      
      // Get user profile
      const user = await this.userService.getProfile(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get API keys
      const apiKeyRecords = await this.apiKeyRepository.find();
      if (!apiKeyRecords || apiKeyRecords.length === 0) {
        throw new Error('No API keys found in the database');
      }
      const apiKeyRecord = apiKeyRecords[0];

      // Get user subscription
      const [userKeyRecord] = await this.subscriptionService.getUserActiveSubscription(userId);
      if (user.role === UserRole.USER && !userKeyRecord) {
        throw new Error('No active subscription package');
      }

      // Check image generation limits
      if (
        user.role === UserRole.USER && 
        imageCount && 
        (userKeyRecord.totalImages < userKeyRecord.imagesGenerated || 
         userKeyRecord.totalImages - userKeyRecord.imagesGenerated < imageCount)
      ) {
        throw new UnauthorizedException('Exceeded maximum image generation limit');
      }

      // Get settings
      const settingPrompt = await this.settingsService.getAllSettings();
      if (!settingPrompt) {
        throw new Error('No setting prompt found in the database');
      }

      // Check token limits for users
      if (user.role === UserRole.USER) {
        const remainingTokens = userKeyRecord.totalTokens - userKeyRecord.tokensUsed;
        if (remainingTokens < 500) {
          throw new BadRequestException('Token limit exceeded');
        }
        maxCompletionTokens = Math.min(remainingTokens, 4000);
      }

      // Initialize AI model
      const textModel = new ChatOpenAI({
        openAIApiKey: apiKeyRecord.openai_key,
        temperature: 0.4,
        modelName: user.role === UserRole.ADMIN ? apiKeyRecord[0].modelType : userKeyRecord.package.modelType,
        maxTokens: user.role === UserRole.ADMIN ? undefined : maxCompletionTokens,
      });

      this.logger.log(`AI Models initialized successfully with model: ${apiKeyRecord.model}`);

      return {
        textModel,
        apiKeyRecord,
        userKeyRecord,
        settingPrompt,
        user,
      };
    } catch (error) {
      this.logger.error(`Failed to initialize AI models: ${error.message}`);
      throw error;
    }
  }

  async trackTokenUsage(userId: number, userKeyRecord: any, operation: string, tokensUsed: number,  metadata: { [key: string]: number } = {}, relatedEntity?: any) {
    try {
      // Update subscription tokens
      await this.subscriptionService.updateSubscription(userId, userKeyRecord.package.id, tokensUsed);
      
      // Track token usage
      await this.subscriptionService.trackTokenUsage(userId, operation, UsageType.TOKEN, metadata, relatedEntity);
    } catch (error) {
      this.logger.error(`Failed to track token usage: ${error.message}`);
      throw error;
    }
  }

  async trackImageUsage(userId: number, userKeyRecord: any, operation: string, imageCount: number = 1, metadata: any = {}, relatedEntity?: any) {
    try {
      // Update subscription images
      await this.subscriptionService.updateSubscription(userId, userKeyRecord.package.id, 0, imageCount);
      
      // Track image usage
      await this.subscriptionService.trackTokenUsage(userId, operation, UsageType.IMAGE, metadata, relatedEntity);
    } catch (error) {
      this.logger.error(`Failed to track image usage: ${error.message}`);
      throw error;
    }
  }

  getTokenUsage(response: any): number {
    if (response?.usage_metadata?.total_tokens !== undefined) {
      return response.usage_metadata.total_tokens;
    }
    return response?.content?.length ? Math.ceil(response.content.length / 4) : 0;
  }

  getImageModelUrl(user: any, userKeyRecord: any, settingPrompt: Settings): string {
    return user.role === UserRole.USER 
      ? userKeyRecord.package.imageModelURL 
      : settingPrompt.coverImageDomainUrl ?? this.configService.get<string>("BASE_URL_FAL_AI");
  }
} 