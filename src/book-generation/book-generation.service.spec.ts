import { Test, TestingModule } from '@nestjs/testing';
import { BookGenerationService } from './book-generation.service';

describe('BookGenerationService', () => {
  let service: BookGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookGenerationService],
    }).compile();

    service = module.get<BookGenerationService>(BookGenerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
