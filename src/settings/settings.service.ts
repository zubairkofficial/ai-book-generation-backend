import { Injectable } from '@nestjs/common';
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
    const setting=await this.settingsRepository.find();
   return setting[0]
  }

  async createOrUpdate(userId: number, settingsDto: UpdateSettingsDto): Promise<Settings> {
    let settings = await this.settingsRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        user: { id: userId },
        ...settingsDto,
      });
    } else {
      this.settingsRepository.merge(settings, settingsDto);
    }

    return this.settingsRepository.save(settings);
  }

  async getTokenConversionSettings() {
    const settings = await this.settingsRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' }
    });

    if (!settings) {
      // Return default values if no settings exist
      return {
        creditsPerModelToken: 1,
        creditsPerImageToken: 1
      };
    }

    return {
      creditsPerModelToken: settings.creditsPerModelToken,
      creditsPerImageToken: settings.creditsPerImageToken
    };
  }

  async updateTokenConversionSettings(dto: TokenConversionDto) {
    let settings = await this.settingsRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' }
    });

    if (!settings) {
      settings = this.settingsRepository.create(dto);
    } else {
      settings.creditsPerModelToken = dto.creditsPerModelToken;
      settings.creditsPerImageToken = dto.creditsPerImageToken;
    }

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
