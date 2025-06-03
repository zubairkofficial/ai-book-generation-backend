// users/dto/update-user.dto.ts
import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  isNewUser?: boolean;
}


export interface UserInterface{ id: number; email?: string; role: string }