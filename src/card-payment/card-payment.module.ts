import { forwardRef, Module } from '@nestjs/common';
import { CardPaymentService } from './card-payment.service';
import { CardPaymentController } from './card-payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardPayment } from './entities/card-payment.entity';
import { UsersModule } from 'src/users/users.module';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { TransactionModule } from 'src/transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CardPayment]),
    UsersModule,
    ApiKeysModule,
    forwardRef(() => TransactionModule), // Wrap with forwardRef
  ],
  controllers: [CardPaymentController],
  providers: [CardPaymentService],
  exports:[CardPaymentService]
})
export class CardPaymentModule {}