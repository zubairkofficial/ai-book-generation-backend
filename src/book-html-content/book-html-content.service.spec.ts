import { Test, TestingModule } from '@nestjs/testing';
import { BookHtmlContentService } from './book-html-content.service';

describe('BookHtmlContentService', () => {
  let service: BookHtmlContentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookHtmlContentService],
    }).compile();

    service = module.get<BookHtmlContentService>(BookHtmlContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
