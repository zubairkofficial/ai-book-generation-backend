import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { TransactionType, TransactionStatus } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, description: 'Type of transaction' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Transaction description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'User ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Card ID' })
  @IsNumber()
  cardId: number;

  @ApiProperty({ description: 'Subscription ID', required: false })
  @IsOptional()
  @IsNumber()
  subscriptionId?: number;

  @ApiProperty({ description: 'Package ID', required: false })
  @IsOptional()
  @IsNumber()
  packageId?: number;

  @ApiProperty({ description: 'Payment ID', required: false })
  @IsOptional()
  @IsNumber()
  paymentId?: number;

  @ApiProperty({ description: 'External reference ID', required: false })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TransactionFilterDto {
  @ApiProperty({ description: 'User ID', required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({ enum: TransactionType, description: 'Transaction type', required: false })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ enum: TransactionStatus, description: 'Transaction status', required: false })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({ description: 'Start date', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: 'End date', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;
} 