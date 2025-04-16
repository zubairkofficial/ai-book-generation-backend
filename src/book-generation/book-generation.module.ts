import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { BookHtmlContentModule } from 'src/book-html-content/book-html-content.module';
import { ChapterPlotChain, EventsChain } from 'src/common/function/chapter-plot-chain';
import { SettingsModule } from 'src/settings/settings.module';
import { UsersModule } from 'src/users/users.module';
import { MarkdownConverter } from 'src/utils/markdown-converter.util';
import { BookGenerationController } from './book-generation.controller';
import { BookGenerationService } from './book-generation.service';
import { BookGeneration } from './entities/book-generation.entity';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { BookChapterService } from 'src/book-chapter/book-chapter.service';
import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookGeneration, ApiKey,BookChapter]),
    UsersModule,
    SettingsModule,
    forwardRef(() => BookHtmlContentModule), // Use forwardRef to avoid circular dependency
 SubscriptionModule,
  ],
  controllers: [BookGenerationController],
  providers: [
    BookGenerationService, 
    ChapterPlotChain, 
    EventsChain,
    MarkdownConverter,
    BookChapterService,
    
  ],
  exports: [BookGenerationService, TypeOrmModule],
})
export class BookGenerationModule {}