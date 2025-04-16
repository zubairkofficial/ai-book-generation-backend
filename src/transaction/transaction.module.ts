import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { UsersModule } from 'src/users/users.module';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { CardPaymentModule } from 'src/card-payment/card-payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    UsersModule,
    forwardRef(() => CardPaymentModule), // Wrap with forwardRef
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}