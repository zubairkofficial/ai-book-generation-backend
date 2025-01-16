import { Test, TestingModule } from '@nestjs/testing';
import { BookGenerationController } from './book-generation.controller';
import { BookGenerationService } from './book-generation.service';

describe('BookGenerationController', () => {
  let controller: BookGenerationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookGenerationController],
      providers: [BookGenerationService],
    }).compile();

    controller = module.get<BookGenerationController>(BookGenerationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
