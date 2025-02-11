import { Module } from '@nestjs/common';
import { BookMetadataService } from './book-metadata.service';
import { BookMetadataController } from './book-metadata.controller';

@Module({
  controllers: [BookMetadataController],
  providers: [BookMetadataService],
})
export class BookMetadataModule {}
