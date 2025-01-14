import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Otp } from './entities/otp.entity';
import { UsersService } from './../users/users.service';
export declare class OtpService implements OnModuleInit {
    private readonly otpRepository;
    private readonly usersService;
    private readonly schedulerRegistry;
    private readonly configService;
    constructor(otpRepository: Repository<Otp>, usersService: UsersService, schedulerRegistry: SchedulerRegistry, configService: ConfigService);
    onModuleInit(): void;
    generateOtp(email: string): Promise<Otp>;
    verifyOtp(email: string, code: string): Promise<boolean>;
    cleanUpExpiredOtps(): Promise<void>;
}
