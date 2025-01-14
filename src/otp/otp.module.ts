import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from 'src/users/users.module'; // Import UsersModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp]), // Register the Otp entity
    ScheduleModule.forRoot(), // For cron jobs
    UsersModule, // Import UsersModule to make UsersService available
  ],
  providers: [OtpService], // Only provide OtpService
  controllers: [OtpController],
  exports: [OtpService], // Export OtpService if needed elsewhere
})
export class OtpModule {}
