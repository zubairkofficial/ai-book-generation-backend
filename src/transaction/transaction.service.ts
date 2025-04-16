import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {  Repository } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';
import { CreateTransactionDto, TransactionFilterDto } from './dto/transaction.dto';
import { UsersService } from 'src/users/users.service';
import { CardPaymentService } from 'src/card-payment/card-payment.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private usersService: UsersService,
  
    @Inject(forwardRef(() => CardPaymentService)) // Use forwardRef here
    private cardPaymentService: CardPaymentService,
  ) {}

  // Create a new transaction
  async createTransaction(createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    const user = await this.usersService.getProfile(createTransactionDto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const cardPayment = await this.cardPaymentService.getCardById(createTransactionDto.cardId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousBalance = +user.availableAmount;
    
    // Create transaction entity
    const transaction = this.transactionRepository.create({
      cardPayment,
      user,
      type: createTransactionDto.type,
      amount: createTransactionDto.amount,
      description: createTransactionDto.description,
      previousBalance,
      metadata: createTransactionDto.metadata,
      status: TransactionStatus.COMPLETED, // Default to completed
    });

    // If it's a payment (adding money) or a refund
    if (createTransactionDto.type === TransactionType.PAYMENT || 
        createTransactionDto.type === TransactionType.REFUND) {
      user.availableAmount += +createTransactionDto.amount;
    } 
    // If it's a subscription charge or renewal
    else if (createTransactionDto.type === TransactionType.SUBSCRIPTION || 
             createTransactionDto.type === TransactionType.RENEWAL) {
      user.availableAmount -= +createTransactionDto.amount;
    }

    // Update transaction with new balance
    transaction.newBalance = +user.availableAmount;
    
    // Save the updated user and transaction
    await this.usersService.updateUserPayment({ 
      amount: user.availableAmount - previousBalance 
    } as any, user);
    
    return await this.transactionRepository.save(transaction);
  }

  // Get all transactions with optional filtering
  async getTransactions(filter: TransactionFilterDto): Promise<Transaction[]> {
    const query = this.transactionRepository.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .leftJoinAndSelect('transaction.subscription', 'subscription')
      .leftJoinAndSelect('transaction.package', 'package')
      .leftJoinAndSelect('transaction.payment', 'payment');

    if (filter.userId) {
      query.andWhere('user.id = :userId', { userId: filter.userId });
    }

    if (filter.type) {
      query.andWhere('transaction.type = :type', { type: filter.type });
    }

    if (filter.status) {
      query.andWhere('transaction.status = :status', { status: filter.status });
    }

    if (filter.startDate && filter.endDate) {
      query.andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filter.startDate),
        endDate: new Date(filter.endDate),
      });
    }

    return await query.orderBy('transaction.createdAt', 'DESC').getMany();
  }

  // Get transaction by ID
  async getTransactionById(id: number): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['user', 'subscription', 'package', 'payment'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  // Get user's transaction history
  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      where: { user: { id: userId } },
      relations: ['subscription', 'package', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  // Update transaction status
  async updateTransactionStatus(id: number, status: TransactionStatus): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);
    transaction.status = status;
    return await this.transactionRepository.save(transaction);
  }
} 