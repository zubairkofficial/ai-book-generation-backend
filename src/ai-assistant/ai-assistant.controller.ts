import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { CreateAiAssistantDto } from './dto/create-ai-assistant.dto';
import { UpdateAiAssistantDto } from './dto/update-ai-assistant.dto';

@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post()
  create(@Body() createAiAssistantDto: CreateAiAssistantDto) {
    return this.aiAssistantService.create(createAiAssistantDto);
  }

  @Get()
  findAll() {
    return this.aiAssistantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiAssistantService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAiAssistantDto: UpdateAiAssistantDto) {
    return this.aiAssistantService.update(+id, updateAiAssistantDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiAssistantService.remove(+id);
  }
}
