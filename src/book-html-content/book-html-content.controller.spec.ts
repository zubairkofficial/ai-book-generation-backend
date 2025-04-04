import { Test, TestingModule } from '@nestjs/testing';
import { BookHtmlContentController } from './book-html-content.controller';
import { BookHtmlContentService } from './book-html-content.service';

describe('BookHtmlContentController', () => {
  let controller: BookHtmlContentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookHtmlContentController],
      providers: [BookHtmlContentService],
    }).compile();

    controller = module.get<BookHtmlContentController>(BookHtmlContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
