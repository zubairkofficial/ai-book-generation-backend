import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePackageDto {
  @ApiProperty({ description: 'Package name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Package description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Package price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Duration in days' })
  @IsNumber()
  @Min(1)
  durationDays: number;

  @ApiProperty({ description: 'Token limit' })
  @IsNumber()
  @Min(0)
  tokenLimit: number;

  @ApiProperty({ description: 'Image generation limit' })
  @IsNumber()
  @Min(0)
  imageLimit: number;

  @ApiProperty({ description: 'AI model type' })
  @IsString()
  @IsOptional()
  modelType?: string;

  @ApiProperty({ description: 'Image model type' })
  @IsString()
  @IsOptional()
  imageModelType?: string;

  @ApiProperty({ description: 'Image model url' })
  @IsString()
  @IsOptional()
  imageModelURL?: string;

  @ApiProperty({ description: 'Whether the package is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Whether this is a free package' })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiProperty({ description: 'Additional features' })
  @IsOptional()
  features?: Record<string, any>;
} 