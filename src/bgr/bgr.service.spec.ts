import { Test, TestingModule } from '@nestjs/testing';
import { BgrService } from './bgr.service';

describe('BgrService', () => {
  let service: BgrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BgrService],
    }).compile();

    service = module.get<BgrService>(BgrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
