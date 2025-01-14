import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { Otp } from './entities/otp.entity';
import { UsersService } from './../users/users.service';

@Injectable()
export class OtpService implements OnModuleInit {
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
    private readonly usersService: UsersService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
  ) {}

  // On initialization, register a dynamic cron job
  onModuleInit() {
    const cronExpression = this.configService.get<string>('OTP_CRON_JOB') || '*/5 * * * *';
    const job = new CronJob(cronExpression, async () => {
      await this.cleanUpExpiredOtps();
    });

    this.schedulerRegistry.addCronJob('cleanUpExpiredOtps', job);
    job.start(); // Start the job
    console.log(`Cron job registered with expression: ${cronExpression}`);
  }

  // Generate OTP
  async generateOtp(email: string): Promise<Otp> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // OTP valid for 5 minutes
    await this.usersService.findByEmail(email);

    const otp = this.otpRepository.create({ email, code, expiresAt });
    return await this.otpRepository.save(otp);
  }

  // Verify OTP
  async verifyOtp(email: string, code: string): Promise<boolean> {
    const otp = await this.otpRepository.findOne({
      where: { email, code, isUsed: false },
    });

    if (!otp) return false; // OTP not found
    if (new Date() > otp.expiresAt) return false; // OTP expired

    // Mark OTP as used
    otp.isUsed = true;
    await this.otpRepository.save(otp);

    return true;
  }

  // Clean Up Expired OTPs
  async cleanUpExpiredOtps() {
    const now = new Date();
    await this.otpRepository.delete({
      expiresAt: LessThan(now),
    });
    console.log('Expired OTPs cleaned up at:', now);
  }
}
