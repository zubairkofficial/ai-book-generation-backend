// users/dto/update-user.dto.ts
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  oldPassword?: string;
  
  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string | null;
}