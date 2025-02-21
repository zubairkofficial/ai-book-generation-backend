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
  Delete,
  Param
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookGenerationService } from './book-generation.service';
import {  BookGenerationDto } from './dto/book-generation.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

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
        throw error.message;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

 

  @UseGuards(JwtAuthGuard)
  @Get('all')
  @ApiOperation({ summary: 'Get all books for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved books.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getAllBooks(@Req() request: RequestWithUser) {
    const user = request.user;
    this.logger.log(`Fetching all books for user ID: ${user.id}`);

    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.getAllBooksByUser(user);
      return {
        message: 'Books successfully retrieved.',
        data: books,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${user.id}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteBookById(@Req() request: RequestWithUser,@Param('id') id:number) {
    const user = request.user;
    
    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.deleteBookById(id);
      return {
        message: 'Books successfully deleted.',
        data: books,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${user.id}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
  @UseGuards(JwtAuthGuard)
  @Get(':type')
  async getBooksByType(@Req() request: RequestWithUser,@Param('type') type:string) {
    const user = request.user;
    
    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.getBooksByType(type,user);
      return {
        message: 'Books successfully deleted.',
        data: books,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${user.id}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  // @UseGuards(JwtAuthGuard)
  // @Get('search-by-id')
  // async searchBookQuery(@Body() input: SearchDto, @Req() request: RequestWithUser) {
  //   const userId = request.user?.id;
  //   this.logger.log(`Fetching books for user ID: ${userId}`);

  //   if (!userId) {
  //     this.logger.error('Unauthorized: User ID not found in the request.');
  //     throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
  //   }

  //   try {
  //     const books = await this.bookGenerationService.searchBookQuery(userId, input);
  //     return {
  //       message: 'Books successfully retrieved.',
  //       data: books,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error retrieving books for user ID: ${userId}`, error.stack);
  //     throw new InternalServerErrorException('An error occurred while fetching books.');
  //   }
  // }


}
