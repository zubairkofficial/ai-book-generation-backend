import { IsEmail, IsString, MinLength, Matches, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' }) // Minimum length reduced to 6
 password: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsPhoneNumber(null, { message: 'Invalid phone number format' }) // Validate phone number format
  phoneNumber: string;
}
