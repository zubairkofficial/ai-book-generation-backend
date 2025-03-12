import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBgrDto {
  @IsOptional() // Mark as optional for when the glossary isn't provided
  @IsString()
  glossary?: string;

  @IsOptional()
  @IsString()
  index?: string;

  @IsOptional()
  @IsString()
  refrence?: string;

  // Optionally, if you need to link BookChapter and BookGeneration to this DTO,
  // You can include their ids here
  @IsNotEmpty()
  @IsNumber()
  chapterId: number;

  @IsNotEmpty()
  @IsNumber()
  bookGenerationId?: number;
}
