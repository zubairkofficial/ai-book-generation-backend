import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'MyNewPass123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, {
    message: 'Password must be at least 6 characters long',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one uppercase letter',
  }) // At least one uppercase letter
  @Matches(/(?=.*[0-9])/, {
    message: 'Password must contain at least one number',
  }) // At least one numeric digit
  newPassword: string;
}
