import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { CardPayment } from './entities/card-payment.entity';
import { CreateCardTokenDto } from './dto/payment.dto';
import { UsersService } from 'src/users/users.service';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';

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
  ) {
   
  }

  private async getStripeApiKey(): Promise<string> {
    const apiKey = await this.apiKeyRepository.find();
    
    if (!apiKey || !apiKey[0]?.stripe_api_key) {
      throw new InternalServerErrorException('Stripe API key not found in the database');
    }

    return apiKey[0].stripe_api_key; // Return the first API key found
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

  async createCard(cardData: CreateCardTokenDto,userId: number) {
    try {
      await this.initializeStripe(); // Initialize Stripe with the API key
    
      const user = await this.usersService.getProfile(
       userId
      );
      const card = new CardPayment();
      card.cardNumber = cardData.cardNumber;
      card.expiryMonth = Number(cardData.expiryMonth);
      card.expiryYear = Number(cardData.expiryYear);
      card.cvc = cardData.cvc;
      card.user = user;
      const cardInput = {
        cardNumber: card.cardNumber,
        expiryMonth: Number(card.expiryMonth),
        expiryYear: Number(card.expiryYear),
        cvc: card.cvc.toString(),
        amount: cardData.amount,
        cardHolderName:cardData.cardHolderName,
        status:"pending"
      };
      await this.cardPaymentRepository.save(cardInput)
      const cardToken = await this.createCardToken(cardData);
      const paymentIntent = await this.createPaymentIntent(
        Math.round(cardData.amount * 100), // Convert to cents
        'usd', // Currency
        cardToken.id // Card token ID
      );
      const updateUser = await this.usersService.updateUserPayment(cardData, user);
     
       return paymentIntent;
    } catch (error) {
      throw new Error(error.message);
    }
  }

 

}
