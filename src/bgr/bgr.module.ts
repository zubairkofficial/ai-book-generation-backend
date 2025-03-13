import { Module } from '@nestjs/common';
import { BgrService } from './bgr.service';
import { BgrController } from './bgr.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { Bgr } from './entities/bgr.entity';

@Module({
    imports: [
      // Register all entities for which you need repositories.
      TypeOrmModule.forFeature([Bgr, BookChapter]),
    ],
  controllers: [BgrController],
  providers: [BgrService],
  exports: [BgrService],
})
export class BgrModule {}
