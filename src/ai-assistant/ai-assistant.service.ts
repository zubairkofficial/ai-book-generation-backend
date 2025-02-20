import { Injectable } from '@nestjs/common';
import { CreateAiAssistantDto } from './dto/create-ai-assistant.dto';
import { UpdateAiAssistantDto } from './dto/update-ai-assistant.dto';

@Injectable()
export class AiAssistantService {
  create(createAiAssistantDto: CreateAiAssistantDto) {
    return 'This action adds a new aiAssistant';
  }

  findAll() {
    return `This action returns all aiAssistant`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiAssistant`;
  }

  update(id: number, updateAiAssistantDto: UpdateAiAssistantDto) {
    return `This action updates a #${id} aiAssistant`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiAssistant`;
  }
}
