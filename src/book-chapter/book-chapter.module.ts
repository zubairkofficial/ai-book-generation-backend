import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookChapterService } from './book-chapter.service';
import { BookChapterController } from './book-chapter.controller';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
// Import any other entities whose repositories are needed.
// For example, if you have BookChapter and ApiKey entities:
import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { EventsChain } from 'src/common/function/chapter-plot-chain';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { SettingsModule } from 'src/settings/settings.module';
import { UsersModule } from 'src/users/users.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [
    // Register all entities for which you need repositories.
    TypeOrmModule.forFeature([BookGeneration, BookChapter, ApiKey]),
    SettingsModule,
    SubscriptionModule,
    UsersModule
  ],
  controllers: [BookChapterController],
  providers: [BookChapterService, EventsChain,],
})
export class BookChapterModule {}
