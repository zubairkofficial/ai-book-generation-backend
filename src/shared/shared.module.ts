import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './services/ai.service';
import { ImageService } from './services/image.service';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { SettingsModule } from 'src/settings/settings.module';
import { UsersModule } from 'src/users/users.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    SettingsModule,
    UsersModule,
    SubscriptionModule,
    ConfigModule,
  ],
  providers: [AiService, ImageService],
  exports: [AiService, ImageService],
})
export class SharedModule {}