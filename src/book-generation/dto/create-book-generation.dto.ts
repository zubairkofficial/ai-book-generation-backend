import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class BookGenerationDto {
  @ApiProperty({ description: 'The title of the book' })
  @IsString()
  @IsNotEmpty()
  bookTitle: string;

  @ApiProperty({ description: 'The genre of the book' })
  @IsString()
  @IsNotEmpty()
  genre: string;

  @ApiProperty({ description: 'The theme of the book' })
  @IsString()
  @IsNotEmpty()
  theme: string;

  @ApiProperty({ description: 'The main characters in the book' })
  @IsString()
  @IsNotEmpty()
  characters: string;

  @ApiProperty({ description: 'The setting of the book' })
  @IsString()
  @IsNotEmpty()
  setting: string;

  @ApiProperty({ description: 'The tone of the book' })
  @IsString()
  @IsNotEmpty()
  tone: string;

  @ApiProperty({ description: 'Plot twists in the book' })
  @IsString()
  @IsNotEmpty()
  plotTwists: string;

  @ApiProperty({ description: 'The number of pages in the book' })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @IsNotEmpty()
  numberOfPages: number;

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
  additionalContent: string; // Optional field
}
