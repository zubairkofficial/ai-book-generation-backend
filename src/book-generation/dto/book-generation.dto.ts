import { IsString, IsNumber, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Express } from 'express';
import { ContentType } from 'src/utils/roles.enum';
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
  @IsOptional()
  characters?: string;

  @ApiProperty({ description: 'The book information idea in the book' })
  @IsString()
  @IsNotEmpty()
  bookInformation: string;

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

export class UpdateBookDto {
  @ApiProperty({ example: 117 })
  @IsNumber()
  @IsNotEmpty()
  bookGenerationId: number;

  @ApiProperty({
    example: 'some-image-url.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiProperty({
    example: 'some-back-cover-url.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  backCoverImageUrl?: string;

  @ApiProperty({
    example: 'Some table of contents text',
    required: false,
  })
  @IsOptional()
  @IsString()
  tableOfContents?: string;

  @ApiProperty({
    example: 'Cover page content goes here',
    required: false,
  })
  @IsOptional()
  @IsString()
  coverPageResponse?: string;

  @ApiProperty({
    example: 'Dedication content goes here',
    required: false,
  })
  @IsOptional()
  @IsString()
  dedication?: string;

  @ApiProperty({
    example: 'Preface content goes here',
    required: false,
  })
  @IsOptional()
  @IsString()
  preface?: string;

  @ApiProperty({
    example: 'Introduction content for the book',
    required: false,
  })
  @IsOptional()
  @IsString()
  introduction?: string;

  @ApiProperty({
    example: 'Some references content',
    required: false,
  })
  @IsOptional()
  @IsString()
  references?: string;

  @ApiProperty({
    example: 'Some index content',
    required: false,
  })
  @IsOptional()
  @IsString()
  index?: string;

  @ApiProperty({
    example: 'Some glossary content',
    required: false,
  })
  @IsOptional()
  @IsString()
  glossary?: string;

  @ApiProperty({
    example: 'Full content of the book goes here',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullContent?: string;


 
}
export class UpdateBookCoverDto {
  @ApiProperty({ example: 117 })
  @IsNumber()
  bookGenerationId?: number;

  @ApiProperty({ description: 'The title of the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  bookTitle?: string;

  @ApiProperty({ description: 'Author name', required: false })
  @IsString()
  @IsOptional()  // Make this field optional
  authorName?: string;

  @ApiProperty({ description: 'A short bio of the author', required: false })
  @IsString()
  @IsOptional()  // Make this field optional
  authorBio?: string;

  @ApiProperty({ description: 'The genre of the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  genre?: string;

  @ApiProperty({ description: 'The main characters in the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  characters?: string;

  @ApiProperty({ description: 'The book information idea in the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  ideaCore?: string;

  @ApiProperty({ description: 'The number of chapters in the book' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsOptional()  // Make this field optional
  numberOfChapters?: number;

  @ApiProperty({ description: 'The target audience for the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  targetAudience?: string;

  @ApiProperty({ description: 'The language of the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  language?: string;

  @ApiProperty({ description: 'The publisher of the book' })
  @IsString()
  @IsOptional()  // Make this field optional
  publisher?: string;
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
export class UpdateDto {
  @ApiProperty({ example: 117 })
  @IsNumber()
  @IsNotEmpty()
  bookId: number;

  @ApiProperty({ example: 'cover' })
  @IsString()
  @IsNotEmpty()
  imageType: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  @IsNotEmpty()
  image: Buffer;
}
export class RegenerateImage {
  @ApiProperty({ example: 117 })
  @IsNumber()
  @IsNotEmpty()
  bookId: number;

  @ApiProperty({ example: 'cover' })
  @IsString()
  @IsNotEmpty()
  imageType: string;

  @IsString()
  @IsNotEmpty()
  additionalContent: string;

 
}


export class BRGDTO {
  @ApiProperty({ example: 117 })
  @IsNumber()
  @IsNotEmpty()
  bookId: number;

  // Step 2: Use the @IsEnum decorator with the enum we just created
  @ApiProperty({ example: 'reference', enum: ContentType })
  @IsEnum(ContentType)
  @IsNotEmpty()
  contentType: ContentType;

  @IsString()
  @IsOptional()
  additionalInfo?: string;

  @IsString()
  @IsOptional()
  currentContent?: string;
}

