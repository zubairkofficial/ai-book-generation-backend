import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { UserSubscription } from 'src/subscription/entities/user-subscription.entity';
import { Package } from 'src/subscription/entities/package.entity';
import { CardPayment } from 'src/card-payment/entities/card-payment.entity';

export enum TransactionType {
  PAYMENT = 'payment',           // Money added to account
  SUBSCRIPTION = 'subscription', // Subscription purchased
  RENEWAL = 'renewal',           // Subscription renewed
  REFUND = 'refund',             // Money refunded
  CANCELLATION = 'cancellation', // Subscription cancelled
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity()
export class Transaction extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => CardPayment, (cardPayment) => cardPayment.transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  cardPayment: CardPayment;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => UserSubscription, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: UserSubscription;

  @ManyToOne(() => Package, { nullable: true })
  @JoinColumn({ name: 'packageId' })
  package?: Package;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousBalance: number; // User's balance before transaction

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newBalance: number; // User's balance after transaction

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>; // Additional transaction details
} 