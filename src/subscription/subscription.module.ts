import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { Package } from './entities/package.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { Usage } from './entities/usage.entity';
import { User } from 'src/users/entities/user.entity';
import { SubscriptionEventListeners } from './subscription.listeners';
import { CardPaymentModule } from 'src/card-payment/card-payment.module';
import { NotificationModule } from 'src/notification/notification.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailService } from 'src/auth/services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Package, UserSubscription, Usage, User]),
    EventEmitterModule.forRoot(),
    CardPaymentModule,
    NotificationModule,
  ],
  providers: [
    SubscriptionService,
    SubscriptionEventListeners,
    EmailService

  ],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {} 