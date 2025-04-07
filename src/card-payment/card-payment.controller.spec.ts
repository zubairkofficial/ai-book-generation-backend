import { Test, TestingModule } from '@nestjs/testing';
import { CardPaymentController } from './card-payment.controller';
import { CardPaymentService } from './card-payment.service';

describe('CardPaymentController', () => {
  let controller: CardPaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardPaymentController],
      providers: [CardPaymentService],
    }).compile();

    controller = module.get<CardPaymentController>(CardPaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
