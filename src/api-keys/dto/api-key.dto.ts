import { IsNotEmpty, IsString } from 'class-validator';

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


