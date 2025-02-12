import { Test, TestingModule } from '@nestjs/testing';
import { BookChapterService } from './book-chapter.service';

describe('BookChapterService', () => {
  let service: BookChapterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookChapterService],
    }).compile();

    service = module.get<BookChapterService>(BookChapterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
