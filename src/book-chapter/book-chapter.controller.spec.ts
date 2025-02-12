import { Test, TestingModule } from '@nestjs/testing';
import { BookChapterController } from './book-chapter.controller';
import { BookChapterService } from './book-chapter.service';

describe('BookChapterController', () => {
  let controller: BookChapterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookChapterController],
      providers: [BookChapterService],
    }).compile();

    controller = module.get<BookChapterController>(BookChapterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
