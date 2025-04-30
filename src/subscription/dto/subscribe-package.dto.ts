import { IsNumber, IsBoolean, IsOptional, Min, IsDateString, IsEnum, IsInt, IsNotEmpty, IsPositive } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreatePackageDto } from './create-package.dto';
import { SubscriptionStatus } from '../entities/user-subscription.entity';

export class SubscribePackageDto {
  @ApiProperty({ description: 'Package ID to subscribe to' })
  @IsNumber()
  packageId: number;

  @ApiProperty({ description: 'Whether to cancel existing subscription' })
  @IsBoolean()
  @IsOptional()
  cancelExisting?: boolean;

  @ApiProperty({ description: 'Whether to auto-renew subscription' })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  
} 
export class FreeSubscriptionPackageDto {
  @IsNotEmpty()
  @ApiProperty({ description: 'User ID to subscribe to' })
  @IsNumber()
  userId: number; // Assuming userId is a string, adjust if it's a different type

  @IsDateString()
  startDate: Date;

  @IsDateString()
  endDate: Date;

  @IsInt()
  @IsNumber()
  @IsOptional()
  tokenLimit: number;

  @IsInt()
  @IsNumber()
  @IsOptional()
  imageLimit: number;

  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @IsOptional()
  autoRenew?: boolean;
   
  @IsOptional()
  fullModelAccess?: boolean; 
} 