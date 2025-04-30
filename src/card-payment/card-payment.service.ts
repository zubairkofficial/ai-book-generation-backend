import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { CardPayment } from './entities/card-payment.entity';
import { ChargeCardDto, CreateCardTokenDto } from './dto/payment.dto';
import { UsersService } from 'src/users/users.service';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { TransactionService } from 'src/transaction/transaction.service';
import { TransactionType } from 'src/transaction/entities/transaction.entity';

@Injectable()
export class CardPaymentService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(CardPayment)
    private cardPaymentRepository: Repository<CardPayment>,
    private configService: ConfigService,
    @InjectRepository(ApiKey) // Inject the ApiKey repository
    private apiKeyRepository: Repository<ApiKey>, // The repository to fetch API keys
  
    private usersService: UsersService,
    private transactionService: TransactionService,
  ) {
   
  }

  private async getStripeApiKey(): Promise<string> {
    const apiKey = await this.apiKeyRepository.find();
    
    if (!apiKey || !apiKey[0]?.stripe_key) {
      throw new InternalServerErrorException('Stripe API key not found in the database');
    }

    return apiKey[0].stripe_key; // Return the first API key found
  }

  // Initialize Stripe with the API key fetched from the database
  private async initializeStripe(): Promise<void> {
    if (!this.stripe) {
      const stripeApiKey = await this.getStripeApiKey(); // Fetch API key from DB
      this.stripe = new Stripe(stripeApiKey, {
        apiVersion: '2025-03-31.basil', // Use the latest API version
      });
    }
  }


  async createPaymentIntent(amount: number, currency: string, cardTokenId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount, // Amount in cents
        currency,
        payment_method_data: {
          type: 'card',
          card: {
            token: cardTokenId,
          },
        },
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      } as any);
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Payment intent creation failed');
    }
  }

  async createCardToken(input: CreateCardTokenDto) {
    try {
      const cardToken = await this.stripe.tokens.create({
        card: {
          number: input.cardNumber,
          exp_month: parseInt(input.expiryMonth),
          exp_year: parseInt(input.expiryYear),
          cvc: input.cvc,
        },
      } as any);
      return cardToken;
    } catch (error) {
      console.error('Error creating card token:', error);
      throw new Error('Card token creation failed');
    }
  }

  async createCard(cardData: CreateCardTokenDto, userId: number) {
    try {
      await this.initializeStripe(); // Initialize Stripe with the API key
  
      // Fetch user profile and create card token in parallel
      const [user, cardToken] = await Promise.all([
        this.usersService.getProfile(userId),
        this.createCardToken(cardData),
      ]);
  
      // Prepare card payment data
      const cardInput = {
        cardNumber: cardData.cardNumber,
        expiryMonth: Number(cardData.expiryMonth),
        expiryYear: Number(cardData.expiryYear),
        cvc: cardData.cvc.toString(),
        amount: cardData.amount,
        cardHolderName: cardData.cardHolderName,
        status: "pending",
        user: user, // Directly assign user object
      };
  
      // Save card payment and create payment intent in parallel
      const paymentIntent = await this.createPaymentIntent(Math.round(cardData.amount * 100), 'usd', cardToken.id);

      // If saveCard is true, save the card payment to the database
      let savedCardPayment;
      if (cardData.saveCard) {
        savedCardPayment = await this.cardPaymentRepository.save(cardInput);
      }
  
      // Update user payment and create transaction
      await Promise.all([
        this.usersService.updateUserPayment(+cardData.amount, user),
        this.transactionService.createTransaction({
          type: TransactionType.PAYMENT,
          amount: Number(cardData.amount),
          description: 'Card payment',
          userId: user.id,
          cardId:savedCardPayment?.id,
          referenceId: paymentIntent.id,
          metadata: {
            cardLastFour: cardData.cardNumber.slice(-4),
            paymentMethod: 'card',
            cardBrand: cardToken.card.brand,
          },
        }),
      ]);
  
      // Update card payment status to succeeded
    if(cardData.saveCard)  await this.cardPaymentRepository.update(savedCardPayment.id, { status: "succeeded" });
  
      return paymentIntent;
    } catch (error) {
      throw new Error(`Failed to create card payment: ${error.message}`);
    }
  }
  async getCardsByUserId(userId: number) {
    try {
      return await this.cardPaymentRepository.find({
        where: { user: { id: userId } }, // Use the user relation to filter
        relations: ['user'], // Optionally include user relation if needed
      });  
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async getCardById(cardId: number) {
    try {
      return await this.cardPaymentRepository.findOne({where:{id:cardId}});  
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async deductAmountToken(input,id:number,userId: number) {
    try {
      await this.initializeStripe(); // Initialize Stripe with the API key
    const user=await this.usersService.getProfile(userId)
      const cardPayment = await this.cardPaymentRepository.findOne({
        where: { id: id, user: { id: userId } }, // Ensure the card belongs to the user
      }); 
      const payload: CreateCardTokenDto = {
        cardNumber: cardPayment.cardNumber,
        expiryMonth: String(cardPayment.expiryMonth),
        expiryYear: String(cardPayment.expiryYear),
        cvc: cardPayment.cvc,
        amount: +input.amount,
        saveCard: input.saveCard, // Set this based on your logic
      };
     const cardToken= await this.createCardToken(payload)
     const  paymentIntent=  await this.createPaymentIntent(Math.round(input.amount * 100), 'usd', cardToken.id)
     await Promise.all([
        this.usersService.updateUserPayment(Number(input.amount), user),
        this.transactionService.createTransaction({
          type: TransactionType.PAYMENT,
          amount: Number(input.amount),
          description: 'Card payment',
          userId: user.id,
          cardId:cardPayment.id,
          referenceId: paymentIntent.id,
          metadata: {
            cardLastFour: cardPayment.cardNumber.slice(-4),
            paymentMethod: 'card',
            cardBrand: cardToken.card.brand,
          },
        }),
      ]);
  
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async deleteCardsByUserId(userId: number,cardId:number) {
    try {
      return await this.cardPaymentRepository.delete({ id:cardId 
      });  
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async chargeWallet(input:ChargeCardDto) {
    try {
      const [userCards]= await this.cardPaymentRepository.find({where:{ user:{id:input.userId} 
      }});  
      const inputData={
        amount:input.amount,
        saveCard:true
      }
    return await  this.deductAmountToken(inputData,userCards.id,input.userId)

    } catch (error) {
      throw new Error(error.message);
    }
  }

 

}
