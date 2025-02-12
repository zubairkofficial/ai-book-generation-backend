import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNumber, IsNotEmpty, IsString, IsOptional } from "class-validator";

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

  
  @IsString()
  @IsOptional()
  additionalInfo: string;

}