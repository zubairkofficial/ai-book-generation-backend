import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  Get,
  Param,
  Res,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { map, catchError } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookGenerationService } from './book-generation.service';
import {  BookGenerationDto, SearchDto } from './dto/book-generation.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { of } from 'rxjs';

@ApiTags('books')
@ApiBearerAuth('JWT-auth')
@Controller('book-generation')
export class BookGenerationController {
  private readonly logger = new Logger(BookGenerationController.name);

  constructor(private readonly bookGenerationService: BookGenerationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  @ApiOperation({ summary: 'Generate and save a book based on provided parameters' })
  @ApiResponse({ status: 201, description: 'The book has been successfully generated and saved.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiBody({ type: BookGenerationDto })
  async generateBook(
    @Body() bookGenerationDto: BookGenerationDto,
    @Req() request: RequestWithUser
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating book for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const savedBook = await this.bookGenerationService.generateAndSaveBook(userId, bookGenerationDto);
      this.logger.log(`Book successfully generated and saved for user ID: ${userId}`);
      return {
        message: 'Book successfully generated and saved.',
        data: savedBook,
      };
    } catch (error) {
      this.logger.error(`Error generating and saving book for user ID: ${userId}`, error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('An error occurred while generating and saving the book.');
    }
  }

 

  @UseGuards(JwtAuthGuard)
  @Get('all')
  @ApiOperation({ summary: 'Get all books for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved books.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getAllBooks(@Req() request: RequestWithUser) {
    const userId = request.user?.id;
    this.logger.log(`Fetching all books for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.getAllBooksByUser(userId);
      return {
        message: 'Books successfully retrieved.',
        data: books,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException('An error occurred while fetching books.');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('search-by-id')
  async searchBookQuery(@Body() input: SearchDto, @Req() request: RequestWithUser) {
    const userId = request.user?.id;
    this.logger.log(`Fetching books for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.searchBookQuery(userId, input);
      return {
        message: 'Books successfully retrieved.',
        data: books,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException('An error occurred while fetching books.');
    }
  }


}
