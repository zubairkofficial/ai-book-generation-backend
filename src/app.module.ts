import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpModule } from './otp/otp.module';
import { BookGenerationModule } from './book-generation/book-generation.module';

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
  ],
})
export class AppModule {}