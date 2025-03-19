import { IsOptional, IsString, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingsDto {
  @ApiProperty({ required: true, description: 'Settings ID' })
  @IsOptional()
  id: number;

  @ApiProperty({ required: false, description: 'Prompt for generating cover images' })
  @IsOptional()
  @IsString()
  coverImagePrompt?: string;

  @ApiProperty({ required: false, description: 'Model used for generating cover images' })
  @IsOptional()
  @IsString()
  coverImageModel?: string;

  @ApiProperty({ required: false, description: 'Model used for generating cover image domain url' })
  @IsOptional()
  @IsString()
  coverImageDomainUrl?: string;

  @ApiProperty({ required: false, description: 'Prompt for generating chapter images' })
  @IsOptional()
  @IsString()
  chapterImagePrompt?: string;

  @ApiProperty({ required: false, description: 'Model used for generating chapter images' })
  @IsOptional()
  @IsString()
  chapterImageModel?: string;

  @ApiProperty({ required: false, description: 'Model used for generating chapter image domain url' })
  @IsOptional()
  @IsString()
  chapterImageDomainUrl?: string;
}
