import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TokenConversionDto } from './dto/token-conversion.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
  ) {}

  async create(userID: number, createSettingsDto: UpdateSettingsDto): Promise<Settings> {
    const settings = this.settingsRepository.create({
      ...createSettingsDto,
      userID,
    });
    return this.settingsRepository.save(settings);
  }

  async getAllSettings(): Promise<Settings> {
    const settings = await this.settingsRepository.find({
      order: { createdAt: 'DESC' },
      take: 1
    });

    if (!settings || settings.length === 0) {
      // Create default settings if none exist
      const defaultSettings = this.settingsRepository.create({
        creditsPerModelToken: 1,
        creditsPerImageToken: 1,
        coverImagePrompt: '',
        chapterImagePrompt: '',
        bookIdeaMasterPrompt: '',
        bookCoverMasterPrompt: '',
        writingAssistantMasterPrompt: '',
        chapterSummaryMasterPrompt: '',
        presentationSlidesMasterPrompt: ''
      });
      return this.settingsRepository.save(defaultSettings);
    }

    return settings[0];
  }

  async createOrUpdate(userId: number, settingsDto: UpdateSettingsDto): Promise<Settings> {
    try {
      // First try to find existing settings
      let settings = await this.settingsRepository.findOne({
        where: {},
        order: { createdAt: 'DESC' }
      });

      if (!settings) {
        // If no settings exist, create new
        settings = this.settingsRepository.create({
          ...settingsDto,
          userID: userId
        });
      } else {
        // Update existing settings
        // Only update fields that are provided in the DTO
        Object.keys(settingsDto).forEach(key => {
          if (settingsDto[key] !== undefined) {
            settings[key] = settingsDto[key];
          }
        });
        settings.userID = userId;
      }

      // Save the settings
      const savedSettings = await this.settingsRepository.save(settings);
      
      if (!savedSettings) {
        throw new Error('Failed to save settings');
      }

      return savedSettings;
    } catch (error) {
      console.error('Error in createOrUpdate settings:', error);
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  async getTokenConversionSettings() {
    const settings = await this.getAllSettings();

    return {
      creditsPerModelToken: settings.creditsPerModelToken,
      creditsPerImageToken: settings.creditsPerImageToken
    };
  }

  async updateTokenConversionSettings(dto: TokenConversionDto) {
    let settings = await this.getAllSettings();

    settings.creditsPerModelToken = +dto.creditsPerModelToken;
    settings.creditsPerImageToken = +dto.creditsPerImageToken;

    await this.settingsRepository.save(settings);

    return {
      message: 'Token conversion settings updated successfully',
      settings: {
        creditsPerModelToken: settings.creditsPerModelToken,
        creditsPerImageToken: settings.creditsPerImageToken
      }
    };
  }
}
