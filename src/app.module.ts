import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpModule } from './otp/otp.module';
import { BookGenerationModule } from './book-generation/book-generation.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { BookChapterModule } from './book-chapter/book-chapter.module';
import { StatsModule } from './stats/stats.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { BookHtmlContentModule } from './book-html-content/book-html-content.module';
import { CardPaymentModule } from './card-payment/card-payment.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_HOST: Joi.string().required(), // Local PostgreSQL host
        DATABASE_PORT: Joi.number().required(), // Default is 5432
        DATABASE_USERNAME: Joi.string().required(), // PostgreSQL username
        DATABASE_PASSWORD: Joi.string().required(), // PostgreSQL password
        DATABASE_NAME: Joi.string().required(), // Database name
      }),
    }),

    // TypeORM Module for Local PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'), // Local PostgreSQL host
        port: configService.get<number>('DATABASE_PORT'), // Default is 5432
        username: configService.get<string>('DATABASE_USERNAME'), // PostgreSQL username
        password: configService.get<string>('DATABASE_PASSWORD'), // PostgreSQL password
        database: configService.get<string>('DATABASE_NAME'), // Database name
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // Add your entities here
        synchronize: true, // Set to false in production
      }),
    }),

    // Application Modules
    AuthModule,
    UsersModule,
    OtpModule,
    BookGenerationModule,
    ApiKeysModule,
    BookChapterModule,
    StatsModule,
    AiAssistantModule,
    AnalyticsModule,
    SettingsModule,
    BookHtmlContentModule,
    CardPaymentModule,
    SubscriptionModule,
    TransactionModule,
  ],
})
export class AppModule {}