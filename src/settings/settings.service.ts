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

  async createOrUpdate(userID: number, updateSettingsDto: UpdateSettingsDto): Promise<Settings> {
    const settings = await this.settingsRepository.findOne({
      where: updateSettingsDto?.id 
        ? { id: updateSettingsDto.id, user: { id: userID } }
        : { user: { id: userID } }
    });

    if (!settings) {
      return this.create(userID, updateSettingsDto);
    }

    return this.settingsRepository.save({ ...settings, ...updateSettingsDto });
  }
}
