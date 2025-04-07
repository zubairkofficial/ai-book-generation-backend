import { 
  Controller, 
  Post, 
  Body,   
  UseGuards, 
  Req, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CardPaymentService } from './card-payment.service';
import {  CreateCardTokenDto } from './dto/payment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class CardPaymentController {
  constructor(private readonly cardPaymentService: CardPaymentService) {}

  @Post('token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a card token for payment' })
  @ApiResponse({ status: 201, description: 'Token created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid card data' })
  async createCardToken(
    @Body() cardData: CreateCardTokenDto,
    @Req() request:RequestWithUser
  ) {
    try {
      const userId = request.user?.id;
      const tokenId = await this.cardPaymentService.createCard(cardData,userId);
      return { 
        success: true,
        token: tokenId,
        message: 'Card token created successfully'
      };
    } catch (error) {
      throw new HttpException(
        error.message, 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
