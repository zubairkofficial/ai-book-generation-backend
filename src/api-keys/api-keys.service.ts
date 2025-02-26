import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

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

  async updateApiKeys(input:UpdateApiKeyDto) {
    try {
      
      let apiKeys = await this.apiKeysRepository.findOne({ where: {id:input.id} });

      if (!apiKeys) {
        apiKeys = this.apiKeysRepository.create({ openai_key:input.openai_key,dalle_key:input.dalle_key,model:input.model,  fal_ai : input.fal_ai });
      } else {
      if(input.openai_key) apiKeys.openai_key = input.openai_key;
      if(input.dalle_key) apiKeys.dalle_key = input.dalle_key;
      if(input.model)  apiKeys.model = input.model;
      if(input.fal_ai)   apiKeys.fal_ai = input.fal_ai;
      }

      await this.apiKeysRepository.save(apiKeys);

      return { message: 'API Keys updated successfully', apiKeys };
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
