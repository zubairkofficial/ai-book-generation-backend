import { Test, TestingModule } from '@nestjs/testing';
import { BookMetadataService } from './book-metadata.service';

describe('BookMetadataService', () => {
  let service: BookMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookMetadataService],
    }).compile();

    service = module.get<BookMetadataService>(BookMetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
