import { Test, TestingModule } from '@nestjs/testing';
import { BookMetadataController } from './book-metadata.controller';
import { BookMetadataService } from './book-metadata.service';

describe('BookMetadataController', () => {
  let controller: BookMetadataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookMetadataController],
      providers: [BookMetadataService],
    }).compile();

    controller = module.get<BookMetadataController>(BookMetadataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
