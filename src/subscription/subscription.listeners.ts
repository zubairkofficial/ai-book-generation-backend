import { Injectable } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class SubscriptionEventListeners {
  constructor(private notificationService: NotificationService) {}

  @OnEvent('subscription.expired')
  async handleSubscriptionExpired(event: {
    userId: number;
    subscriptionId: number;
    packageName: string;
    expirationDate: Date;
  }) {
    await this.notificationService.sendEmail({
      to: event.userId,
      template: 'subscription-expired',
      data: {
        packageName: event.packageName,
        expirationDate: event.expirationDate
      }
    });
  }

  @OnEvent('subscription.expiring_soon')
  async handleSubscriptionExpiringSoon(event: {
    userId: number;
    subscriptionId: number;
    packageName: string;
    expirationDate: Date;
    daysRemaining: number;
  }) {
    await this.notificationService.sendEmail({
      to: event.userId,
      template: 'subscription-expiring-soon',
      data: {
        packageName: event.packageName,
        expirationDate: event.expirationDate,
        daysRemaining: event.daysRemaining
      }
    });
  }

  @OnEvent('subscription.renewed')
  async handleSubscriptionRenewed(event: {
    userId: number;
    subscriptionId: number;
    packageName: string;
    endDate: Date;
  }) {
    await this.notificationService.sendEmail({
      to: event.userId,
      template: 'subscription-renewed',
      data: {
        packageName: event.packageName,
        endDate: event.endDate
      }
    });
  }

  @OnEvent('subscription.payment.failed')
  async handlePaymentFailed(event: {
    userId: number;
    subscriptionId: number;
    packageName: string;
    error: string;
  }) {
    await this.notificationService.sendEmail({
      to: event.userId,
      template: 'payment-failed',
      data: {
        packageName: event.packageName,
        error: event.error,
        renewLink: `/subscription/renew/${event.subscriptionId}`
      }
    });
  }
} 