import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, TransactionFilterDto } from './dto/transaction.dto';
import { Transaction } from './entities/transaction.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role } from 'src/utils/roles.enum';

@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new transaction (Admin only)' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    return this.transactionService.createTransaction(createTransactionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all transactions with filtering (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return all transactions based on filter' })
  async getTransactions(@Query() filter: TransactionFilterDto): Promise<Transaction[]> {
    return this.transactionService.getTransactions(filter);
  }

  @Get('my-transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user transactions' })
  @ApiResponse({ status: 200, description: 'Return user transactions' })
  async getUserTransactions(@Req() req: RequestWithUser): Promise<Transaction[]> {
    return this.transactionService.getUserTransactions(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Return the transaction' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionById(@Param('id') id: number, @Req() req: RequestWithUser): Promise<Transaction> {
    const transaction = await this.transactionService.getTransactionById(id);
    
    // Only admin or the transaction owner can view transaction details
    if (req.user.role !== 'admin' && transaction.user.id !== req.user.id) {
      throw new Error('Unauthorized access to transaction');
    }
    
    return transaction;
  }
} 