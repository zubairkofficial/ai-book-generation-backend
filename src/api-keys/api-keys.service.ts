import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeysRepository: Repository<ApiKey>,
  ) {}

  async getApiKeys() {
    try {
      const apiKeys = await this.apiKeysRepository.find();


      if (!apiKeys) {
        throw new HttpException('API keys not found', HttpStatus.NOT_FOUND);
      }

      return apiKeys[0];
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateApiKeys(input:CreateApiKeyDto) {
    try {
      if (!input.openai_key || !input.dalle_key) {
        throw new HttpException('Invalid API keys provided', HttpStatus.BAD_REQUEST);
      }

      let apiKeys = await this.apiKeysRepository.findOne({ where: {} });

      if (!apiKeys) {
        apiKeys = this.apiKeysRepository.create({ openai_key:input.openai_key,dalle_key:input.dalle_key,model:input.model });
      } else {
        apiKeys.openai_key = input.openai_key;
        apiKeys.dalle_key = input.dalle_key;
        apiKeys.model = input.model;
      }

      await this.apiKeysRepository.save(apiKeys);

      return { message: 'API Keys updated successfully', apiKeys };
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
