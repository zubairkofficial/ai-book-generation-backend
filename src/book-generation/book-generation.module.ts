import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookGenerationService } from './book-generation.service';
import { BookGenerationController } from './book-generation.controller';
import { BookGeneration } from './entities/book-generation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookGeneration]), // Register BookGeneration entity
  ],
  controllers: [BookGenerationController],
  providers: [BookGenerationService],
})
export class BookGenerationModule {}
