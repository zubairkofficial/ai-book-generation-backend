import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';
import { Package } from './package.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PAYMENT_FAILED = 'payment_failed'
}

@Entity()
export class UserSubscription extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Package)
  @JoinColumn({ name: 'packageId' })
  package: Package;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'int', default: 0 })
  tokensUsed: number;

  @Column({ type: 'int', default: 0 })
  imagesGenerated: number;

  @Column({ type: 'boolean', default: false })
  autoRenew: boolean;

} 