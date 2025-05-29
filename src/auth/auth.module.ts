import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { CryptoService } from 'src/utils/crypto.service';
import { OtpModule } from 'src/otp/otp.module';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Package } from 'src/subscription/entities/package.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSubscription } from 'src/subscription/entities/user-subscription.entity';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { Usage } from 'src/subscription/entities/usage.entity';
import { User } from 'src/users/entities/user.entity';
import { CardPaymentService } from 'src/card-payment/card-payment.service';
import { CardPayment } from 'src/card-payment/entities/card-payment.entity';
import { TransactionService } from 'src/transaction/transaction.service';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { SettingsService } from 'src/settings/settings.service';
import { Settings } from 'src/settings/entities/settings.entity';

@Module({
  imports: [
    UsersModule,
    OtpModule,
    TypeOrmModule.forFeature([Package,UserSubscription,Usage,User,ApiKey,CardPayment,Transaction,Settings]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('EXPIRY_IN') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy,EmailService,CryptoService,SubscriptionService,CardPaymentService,TransactionService,SettingsService],
  exports: [AuthService],
})
export class AuthModule {}