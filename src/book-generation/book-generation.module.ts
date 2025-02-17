import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookGenerationService } from './book-generation.service';
import { BookGenerationController } from './book-generation.controller';
import { BookGeneration } from './entities/book-generation.entity';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { ChapterPlotChain, EventsChain } from 'src/common/function/chapter-plot-chain';

@Module({
  imports: [
    // Now registering BookGeneration, ApiKey, and BookMetadata repositories
    TypeOrmModule.forFeature([BookGeneration, ApiKey]),
  ],
  controllers: [BookGenerationController],
  providers: [BookGenerationService, ChapterPlotChain, EventsChain],
  exports: [BookGenerationService],
})
export class BookGenerationModule {}
