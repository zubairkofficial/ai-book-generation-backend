import { PartialType } from '@nestjs/swagger';
import { CreateAiAssistantDto } from './create-ai-assistant.dto';

export class UpdateAiAssistantDto extends PartialType(CreateAiAssistantDto) {}
