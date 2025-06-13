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
  description: string;
}

export class BookCoverDTO {
  @IsString()
  bookTitle: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  authorName?: string;

  @IsString()
  genre: string;

  @IsString()
  @IsOptional()
  coreIdea?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  numberOfImages: string;
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
