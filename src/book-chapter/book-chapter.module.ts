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

@Module({
  imports: [
    // Register all entities for which you need repositories.
    TypeOrmModule.forFeature([BookGeneration, BookChapter, ApiKey]),
  ],
  controllers: [BookChapterController],
  providers: [BookChapterService, EventsChain],
})
export class BookChapterModule {}
