import { PartialType } from '@nestjs/swagger';
import { CreatePackageDto } from './create-package.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePackageDto extends PartialType(CreatePackageDto) {
  @ApiProperty({ 
    description: 'Set package active or inactive status', 
    required: false,
    example: true 
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ 
    description: 'Set package free active or inactive status', 
    required: false,
    example: true 
  })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
} 