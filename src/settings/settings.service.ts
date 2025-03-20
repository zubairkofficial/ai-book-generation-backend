import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
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

  async createOrUpdate(userID: number, input: UpdateSettingsDto): Promise<Settings> {
    const settingsResponse = await this.settingsRepository.find();
const settings=settingsResponse[0]
    if (!settings) {
      return this.create(userID, input);
    }else{
      if(input.chapterImageDomainUrl)settings.chapterImageDomainUrl=input.chapterImageDomainUrl
      if(input.chapterImageModel)settings.chapterImageModel=input.chapterImageModel
      if(input.chapterImagePrompt)settings.chapterImagePrompt=input.chapterImagePrompt
      if(input.coverImageDomainUrl)settings.coverImageDomainUrl=input.coverImageDomainUrl
      if(input.coverImageModel)settings.coverImageModel=input.coverImageModel
      if(input.coverImagePrompt)settings.coverImagePrompt=input.coverImagePrompt
      return this.settingsRepository.save(settings);
    }

  }

}
