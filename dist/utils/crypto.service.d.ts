import { ConfigService } from '@nestjs/config';
export declare class CryptoService {
    private readonly configService;
    constructor(configService: ConfigService);
    encrypt(data: string): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
}
