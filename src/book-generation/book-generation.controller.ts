import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Adjust the import path
import { BookGenerationService } from './book-generation.service';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface'; // Adjust the import path
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';

@ApiTags('books')
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
  async generateBook(@Body() bookGenerationDto: BookGenerationDto, @Req() request: RequestWithUser) {
    const userId = request.user?.id;
    this.logger.log(`Generating book for user ID: ${userId}`);

    // Check if the user ID is available in the request
    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      // Generate and save the book
      const savedBook = await this.bookGenerationService.generateAndSaveBook(userId, bookGenerationDto);

      this.logger.log(`Book successfully generated and saved for user ID: ${userId}`);

      // Return a success response
      return {
        message: 'Book successfully generated and saved.',
        data: savedBook,
      };
    } catch (error) {
      this.logger.error(`Error generating and saving book for user ID: ${userId}`, error.stack);

      // Handle specific errors
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw UnauthorizedException as is
      }

      // Handle unexpected errors
      throw new InternalServerErrorException('An error occurred while generating and saving the book.');
    }
  }
}