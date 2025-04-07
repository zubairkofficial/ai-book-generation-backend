import { Module } from '@nestjs/common';
import { CardPaymentService } from './card-payment.service';
import { CardPaymentController } from './card-payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardPayment } from './entities/card-payment.entity';
import { UsersModule } from 'src/users/users.module';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';

@Module({
  imports: [
      TypeOrmModule.forFeature([CardPayment]),
      UsersModule,
      ApiKeysModule
        ],
  controllers: [CardPaymentController],
  providers: [CardPaymentService],
})
export class CardPaymentModule {}
