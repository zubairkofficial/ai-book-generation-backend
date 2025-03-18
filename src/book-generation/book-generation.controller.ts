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
  Param,
  Put,
  UseInterceptors,
  UploadedFile,
  Sse
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookGenerationService } from './book-generation.service';
import {  BookGenerationDto, BRGDTO, RegenerateImage, UpdateBookCoverDto, UpdateBookDto, UpdateDto } from './dto/book-generation.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {  BookType } from './entities/book-generation.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, Subject } from 'rxjs';

@ApiTags('books')
@ApiBearerAuth('JWT-auth')
@Controller('book-generation')
export class BookGenerationController {
  private readonly logger = new Logger(BookGenerationController.name);
 private bookBGRUpdates = new Map<number, Subject<string>>();
 
  constructor(private readonly bookGenerationService: BookGenerationService) {}

  private getBookGenenrate(userId: number, subjectMap: Map<number, Subject<string>>): Subject<string> {
    if (!subjectMap.has(userId)) {
      subjectMap.set(userId, new Subject<string>());
      this.logger.log(`Created new subject for user ID: ${userId}`);
    }
    return subjectMap.get(userId);
  }
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
  @Put('update-book-generated')
  async updateBookGenerate(
    @Body() bookGenerationDto: UpdateBookDto,
    @Req() request: RequestWithUser
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating book for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const updateBook = await this.bookGenerationService.updateBookGenerate(userId, bookGenerationDto);
      this.logger.log(`Book successfully generated and saved for user ID: ${userId}`);
      return {
        message: 'Book successfully generated and saved.',
        data: updateBook,
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
  @Put('update-book-cover')
  async updateBookGenerateCover(
    @Body() bookGenerationDto: UpdateBookCoverDto,
    @Req() request: RequestWithUser
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating book for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const updateBook = await this.bookGenerationService.updateBookGenerateCover(userId, bookGenerationDto);
      this.logger.log(`Book successfully generated and saved for user ID: ${userId}`);
      return {
        message: 'Book successfully generated and saved.',
        data: updateBook,
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
  @Get(':bookId')
  async getBookById(
    @Req() request: RequestWithUser,
    @Param('bookId') bookId: string
  ) {
    const user = request.user;
    this.logger.log(`Fetching book for user ID: ${user.id}`);
  
    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    try {
      const getBook = await this.bookGenerationService.getBookById(+bookId);
      return {
        message: 'Book successfully retrieved.',
        data: getBook,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${user.id}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('brg')
  async generateBookEndContent(
    @Req() request: RequestWithUser,
    @Body() input:BRGDTO
  ) {
    const user = request.user;
    this.logger.log(`Fetching book for user ID: ${user.id}`);
  
    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    try {
      const bookBGR = this.getBookGenenrate(user.id, this.bookBGRUpdates);
      
      const getBook = await this.bookGenerationService.generateBookEndContent(input,(text: string) => {
        bookBGR.next(text);
      },user);
      return {
        message: 'Book successfully retrieved.',
        data: getBook,
      };
    } catch (error) {
      this.logger.error(`Error retrieving books for user ID: ${user.id}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
  
  @UseGuards(JwtAuthGuard)
  @Put('update-image')
  @UseInterceptors(FileInterceptor('image')) // Handling file upload
  async updateBookImage(
    @Req() request: RequestWithUser,
    @UploadedFile() image: Express.Multer.File,
    @Body() input: Omit<UpdateDto, 'image'>,
  ) {
    const user = request.user;
  
    if (!user) {
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    try {
      const updateBookImage = await this.bookGenerationService.updateBookImage({
        ...input,
        image: image.buffer,  // Converting file to buffer
      });
      return {
        message: 'Book successfully updated.',
        data: updateBookImage,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }



    @UseGuards(JwtAuthGuard)
    @Sse('/book-end-stream/bgr')
    bookEndData(@Req() request: RequestWithUser): Observable<{ data: { text: string } }> {
      const userId = request.user?.id;
      if (!userId) {
        throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
      }
    
      const userSubject = this.getBookGenenrate(userId, this.bookBGRUpdates);
    
      return new Observable((observer) => {
        const subscription = userSubject.subscribe({
          next(data) {
            observer.next({
              data: { text: data },
            });
          },
          error(err) {
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
    
        // Clean up on unsubscribe
        return () => {
          subscription.unsubscribe();
        };
      });
    }
    
  @UseGuards(JwtAuthGuard)
  @Put('regenerate-image')
  async regenerateBookImage(
    @Req() request: RequestWithUser,
   
    @Body() input:RegenerateImage,
  ) {
    const user = request.user;
  
    if (!user) {
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    try {
      const updateBookImage = await this.bookGenerationService.regenerateBookImage(
        input  // Converting file to buffer
      );
      return {
        message: 'Book successfully updated.',
        data: updateBookImage,
      };
    } catch (error) {
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
  @Get('search/:type')
  async getBooksByType(@Req() request: RequestWithUser,@Param('type') type:string) {
    const user = request.user;
    const bookType=type=='draft'?BookType.INCOMPLETE:BookType.COMPLETE
    if (!user) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      const books = await this.bookGenerationService.getBooksByType(bookType,user);
      return {
        message: 'Books successfully retrieved.',
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
