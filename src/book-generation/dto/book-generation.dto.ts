import { IsString, IsNumber, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class BookGenerationDto {
 
 

  @ApiProperty({ description: 'The title of the book' })
  @IsString()
  @IsNotEmpty()
  bookTitle: string;


  @ApiProperty({ description: 'Author name', required: false })
  @IsString()
  @IsOptional()
  authorName?: string;

  @ApiProperty({ description: 'A short bio of the author', required: false })
  @IsString()
  @IsOptional()
  authorBio: string;

  @ApiProperty({ description: 'The genre of the book' })
  @IsString()
  @IsNotEmpty()
  genre: string;


  @ApiProperty({ description: 'The main characters in the book' })
  @IsString()
  @IsNotEmpty()
  characters: string;

  @ApiProperty({ description: 'The core idea in the book' })
  @IsString()
  @IsNotEmpty()
  ideaCore: string;

  // @ApiProperty({ description: 'The number of pages in the book' })
  // @Transform(({ value }) => parseInt(value, 10))
  // @IsNumber()
  // @IsNotEmpty()
  // numberOfPages: number;

  @ApiProperty({ description: 'The number of chapters in the book' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  numberOfChapters: number;

  @ApiProperty({ description: 'The target audience for the book' })
  @IsString()
  @IsNotEmpty()
  targetAudience: string;

  @ApiProperty({ description: 'The language of the book' })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({ description: 'Additional content or notes for the book', required: false })
  @IsString()
  @IsOptional()
  additionalContent: string;

  // @ApiProperty({ description: 'FlowChart make or not', required: false })
  // @IsBoolean()
  // isFlowChart: boolean;

  // @ApiProperty({ description: 'Diagram make or not', required: false })
  // @IsBoolean()
  // isDiagram: boolean;
}
export class BookChapterGenerationDto {

  @ApiProperty({ description: 'The number of minimum characters in the Chapter' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  minCharacters: number;

  @ApiProperty({ description: 'The number of maximum characters in the Chapter' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  maxCharacters: number;

  @ApiProperty({ description: 'Book Chapter No' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  chapterNo: number;

  @ApiProperty({ description: 'book Generation Id' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  bookGenerationId: number;

  
}
export class SearchDto {


  @ApiProperty({ description: 'Search by book title', required: false })
  @IsString()
  @IsOptional()
  bookTitle?: string;

  @ApiProperty({ description: 'Search by genre', required: false })
  @IsString()
  @IsOptional()
  genre?: string;

  @ApiProperty({ description: 'Search by theme', required: false })
  @IsString()
  @IsOptional()
  theme?: string;

  @ApiProperty({ description: 'Search by target audience', required: false })
  @IsString()
  @IsOptional()
  targetAudience?: string;

  @ApiProperty({ description: 'Search by language', required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ description: 'Search by number of pages', required: false })
  @IsNumber()
  @IsOptional()
  numberOfPages?: number;

  @ApiProperty({ description: 'Search by flowchart availability', required: false })
  @IsBoolean()
  @IsOptional()
  isFlowChart?: boolean;

  @ApiProperty({ description: 'Search by diagram availability', required: false })
  @IsBoolean()
  @IsOptional()
  isDiagram?: boolean;
}
