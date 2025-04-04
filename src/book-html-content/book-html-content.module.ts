import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookHtmlContent } from './entities/book-html-content.entity';
import { BookHtmlContentService } from './book-html-content.service';
import { BookHtmlContentController } from './book-html-content.controller';
import { BookGenerationModule } from 'src/book-generation/book-generation.module'; // Ensure this path is correct

@Module({
  imports: [
    TypeOrmModule.forFeature([BookHtmlContent]),
    forwardRef(() => BookGenerationModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [BookHtmlContentController],
  providers: [BookHtmlContentService],
  exports: [BookHtmlContentService, TypeOrmModule],
})
export class BookHtmlContentModule {}