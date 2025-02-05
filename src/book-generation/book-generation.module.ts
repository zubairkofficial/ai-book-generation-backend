import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookGenerationService } from './book-generation.service';
import { BookGenerationController } from './book-generation.controller';
import { BookGeneration } from './entities/book-generation.entity';
import { ChapterPlotChain, EventsChain } from 'src/common/function/chapter-plot-chain';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookGeneration,ApiKey]), // Register BookGeneration entity
  ],
  controllers: [BookGenerationController],
  providers: [BookGenerationService,ChapterPlotChain,EventsChain],
})
export class BookGenerationModule {}
