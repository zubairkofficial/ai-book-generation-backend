import { Test, TestingModule } from '@nestjs/testing';
import { BgrController } from './bgr.controller';
import { BgrService } from './bgr.service';

describe('BgrController', () => {
  let controller: BgrController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BgrController],
      providers: [BgrService],
    }).compile();

    controller = module.get<BgrController>(BgrController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
