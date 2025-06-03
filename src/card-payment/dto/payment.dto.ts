import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePaymentDto {
  @ApiProperty({ example: 99.99, description: "Payment amount" })
  @IsNumber()
  @Min(0.5)
  amount: number;

  @ApiProperty({
    example: "USD",
    description: "Currency code",
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: "Card token from Stripe" })
  @IsNotEmpty()
  @IsString()
  cardToken: string;

  @ApiProperty({ description: "Payment description", required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class PaymentResponseDto {
  success: boolean;
  message: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

export class CreateCardTokenDto {
  @ApiProperty({ example: "4242424242424242", description: "Card number" })
  @IsNotEmpty()
  @IsString()
  @Length(13, 19) // Card numbers typically range from 13 to 19 digits
  cardNumber: string;

  @ApiProperty({ example: 12, description: "Expiration month (1-12)" })
  @IsString()
  @Length(2, 2)
  expiryMonth: string;

  @ApiProperty({ example: 2025, description: "Expiration year" })
  @IsString()
  @Length(4, 4)
  expiryYear: string;

  @ApiProperty({ example: "123", description: "CVC/CVV code" })
  @IsNotEmpty()
  @IsString()
  @Length(3, 4)
  cvc: string;

  @IsNotEmpty()
  @IsInt()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsBoolean()
  saveCard: boolean;

  @IsNotEmpty()
  @IsBoolean()
  isFree: boolean;

  
  @ApiProperty({ description: "Card holder name", required: false })
  @IsOptional()
  @IsString()
  cardHolderName?: string;
}
export class ChargeCardDto {
  @IsNumber()
 userId:number
 
 @IsNumber()
 amount:number

 @IsNumber()
 currency:string
}
