import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Transaction } from 'src/transaction/entities/transaction.entity';

@Entity()
export class CardPayment extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
  
  @Column()
  cardNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ length: 50 })
  status: string; // 'succeeded', 'failed', 'pending', etc.

  @Column({ length: 100, nullable: true })
  stripePaymentId: string;

  @Column({ length: 4, nullable: true })
  cvc: string; // Last 4 digits of card number (for display only)

  @Column({ type: 'int', nullable: true })
  expiryMonth: number;

  @Column({ type: 'int', nullable: true })
  expiryYear: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>; // Additional payment details

    @OneToMany(() => Transaction, (transaction) => transaction.cardPayment, { onDelete: 'CASCADE' })
    transaction: Transaction[];
  
}