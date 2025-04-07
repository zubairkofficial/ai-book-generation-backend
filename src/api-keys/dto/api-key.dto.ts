import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  openai_key: string;

  @IsNotEmpty()
  @IsString()
  dalle_key: string;

  @IsNotEmpty()
  @IsString()
  model: string;
}
export class UpdateApiKeyDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsNotEmpty()
  @IsOptional()
  openai_key: string;

  

  @IsNotEmpty()
  @IsOptional()
  model: string;

  @IsNotEmpty()
  @IsOptional()
  fal_ai: string;

  @IsNotEmpty()
  @IsOptional()
  stripe_api_key: string;
}


