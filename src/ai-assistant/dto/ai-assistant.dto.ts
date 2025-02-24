import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AiAssistantType } from '../entities/ai-assistant.entity';
import { Type } from 'class-transformer';

export class StoryDTO {
  @IsString()
  genre: string;

  @IsString()
  targetAudience: string;

  @IsString()
  themeOrTopic: string;

  @IsString()
  specificElements: string;

  @IsString()
  description: string;
}

export class BookCoverDTO {
  @IsString()
  bookTitle: string;

  @IsString()
  genre: string;

  @IsString()
  coverStyle: string;

  @IsString()
  colorPreference: string;

  @IsString()
  targetAudience: string;

  @IsString()
  additionalElements: string;
}
export class BookWriteDTO {
  @IsString()
  writingGoal: string;

  @IsString()
  genre: string;

  @IsString()
  targetAudience: string;

  @IsOptional()
  @IsString()
  currentChallenges?: string;

  @IsOptional()
  @IsString()
  specificArea?: string;

  @IsString()
  writingLevel: string;

  
}


export class AiAssistantDto {
  @IsEnum(AiAssistantType)
  type: AiAssistantType;

  @ValidateNested()
  @Type(() => StoryDTO)
  information?: StoryDTO;

  @ValidateNested()
  @Type(() => BookCoverDTO)
  bookCoverInfo?: BookCoverDTO;
  
  @ValidateNested()
  @Type(() => BookWriteDTO)
  bookWriteInfo?: BookWriteDTO;

  
}
export class AiAssistantMessage {
@IsString()
  message:string
  
@IsNumber()
  aiAssistantId:number
  
}
