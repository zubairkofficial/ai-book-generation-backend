import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CryptoService {
  constructor(private readonly configService: ConfigService) {} // Inject ConfigService

  async encrypt(data: string): Promise<string> {
    const saltRounds = this.configService.get<number>('SALT_ROUNDS'); // Get salt rounds from environment
    const salt = await bcrypt.genSalt(Number(saltRounds));
    return bcrypt.hash(data, salt);
  }

  async compare(data: string, encrypted: string): Promise<boolean> {
    return bcrypt.compare(data, encrypted);
  }
}