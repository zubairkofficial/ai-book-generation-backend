import { Controller, Post, Body, Req, UnauthorizedException, UseGuards, Logger, Param, Res, Sse, InternalServerErrorException, Put } from '@nestjs/common';
import { BookChapterService } from './book-chapter.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';
import { BookChapterDto, BookChapterGenerationDto, BookChapterUpdateDto, SlideGenerationDto } from './dto/book-chapter.dto';
import { Observable, Subject } from 'rxjs';

@Controller('book-chapter')
export class BookChapterController {
  private readonly logger = new Logger(BookChapterController.name);
  
  // Maps to store user-specific subjects
  private chapterTextUpdates = new Map<number, Subject<string>>();
  private summaryTextUpdates = new Map<number, Subject<string>>();
  private slideTextUpdates = new Map<number, Subject<string>>();

  constructor(private readonly bookChapterService: BookChapterService) {}

  // Helper to get or create a Subject for a specific user
  private getUserSubject(userId: number, subjectMap: Map<number, Subject<string>>): Subject<string> {
    if (!subjectMap.has(userId)) {
      subjectMap.set(userId, new Subject<string>());
      this.logger.log(`Created new subject for user ID: ${userId}`);
    }
    return subjectMap.get(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('chapter/create')
  async generateChapterOfBook(
    @Body() bookGenerationDto: BookChapterGenerationDto,
    @Req() request: RequestWithUser,
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating chapter for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      // Get user-specific subject
      const userSubject = this.getUserSubject(userId, this.chapterTextUpdates);
      
      // Generate chapter and stream it via SSE
      const savedChapter = await this.bookChapterService.generateChapterOfBook(
        bookGenerationDto,
        userId,
        (text: string) => {
          userSubject.next(text);
        }
      );
      
      this.logger.log(`Chapter successfully generated and saved for user ID: ${userId}`);
      
      return {
        statusCode: 200,
        message: 'Chapter successfully generated and saved.',
        data: savedChapter,
      };
    } catch (error) {
      this.logger.error(`Error generating and saving chapter for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-chapter')
  async updateChapter(
    @Body() bookGenerationDto: BookChapterUpdateDto,
    @Req() request: RequestWithUser,
  ) {
    const userId = request.user?.id;
    this.logger.log(`Updating chapter for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      // Generate chapter and stream it via SSE
      const savedChapter = await this.bookChapterService.updateChapter(bookGenerationDto,userId);
      this.logger.log(`Chapter successfully updated for user ID: ${userId}`);
      
      return {
        statusCode: 200,
        message: 'Chapter successfully updated.',
        data: savedChapter,
      };
    } catch (error) {
      this.logger.error(`Error updating chapter for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Sse('chapter-stream')
  streamChapter(@Req() request: RequestWithUser): Observable<{data:{text:string}}> {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
    
    // Create a subject if it doesn't exist yet
    const userSubject = this.getUserSubject(userId, this.chapterTextUpdates);
    
    return new Observable((observer) => {
      const subscription = userSubject.subscribe({
        next(data) {
          observer.next({
            data: {text: data}
          });
        },
        error(err) { observer.error(err); },
        complete() { observer.complete(); }
      });
      
      // Clean up on unsubscribe
      return () => {
        subscription.unsubscribe();
        // Optional: remove the subject if no more listeners
        // this.chapterTextUpdates.delete(userId);
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('summary')
  async generateChapterSummary(
    @Body() summaryRequest: BookChapterDto,
    @Req() request: RequestWithUser,
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating chapter summaries for user ID: ${userId}, bookId: ${summaryRequest.bookId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      // Get user-specific subject
      const userSubject = this.getUserSubject(userId, this.summaryTextUpdates);
      
      await this.bookChapterService.generateChapterSummaries(
        summaryRequest,
        userId,
        (text: string) => {
          userSubject.next(text);
        }
      );
      
      return {
        statusCode: 200,
        message: 'Chapter summaries generation started.',
      };
    } catch (error) {
      this.logger.error(`Error generating chapter summaries for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Sse('summary-stream')
  streamSummary(@Req() request: RequestWithUser): Observable<{data:{text:string}}> {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
    
    // Create a subject if it doesn't exist yet
    const userSubject = this.getUserSubject(userId, this.summaryTextUpdates);
    
    return new Observable((observer) => {
      const subscription = userSubject.subscribe({
        next(data) {
          observer.next({
            data: {text: data}
          });
        },
        error(err) { observer.error(err); },
        complete() { observer.complete(); }
      });
      
      return () => {
        subscription.unsubscribe();
        // Optional: remove the subject if no more listeners
        // this.summaryTextUpdates.delete(userId);
      };
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('presentation-slides')
  async generateChapterSlides(
    @Body() slideRequest: { bookId: number, chapterIds: number[], numberOfSlides: number },
    @Req() request: RequestWithUser,
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating chapter slides for user ID: ${userId}, bookId: ${slideRequest.bookId}`);
  
    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    try {
      // Get user-specific subject
      const userSubject = this.getUserSubject(userId, this.slideTextUpdates);
      const slides = await this.bookChapterService.generateChapterSlides(
        slideRequest.bookId,
        slideRequest.chapterIds,
        slideRequest.numberOfSlides,
        userId,
        (text: string) => {
          userSubject.next(text);
        }
      );
  
      // Signal the stream to finish by sending a done message
      userSubject.next('done');  // Send the done signal to the stream
  
      return {
        statusCode: 200,
        message: 'Chapter slides generation started.',
        slides: slides,  // Add the complete slides object
      };
    } catch (error) {
      this.logger.error(`Error generating chapter slides for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException(error.message);
    }
  }
  
  @UseGuards(JwtAuthGuard)
  @Sse('slides-stream')
  streamSlides(@Req() request: RequestWithUser): Observable<{ data: { text: string } }> {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }
  
    // Create a subject if it doesn't exist yet
    const userSubject = this.getUserSubject(userId, this.slideTextUpdates);
  
    return new Observable((observer) => {
      const subscription = userSubject.subscribe({
        next(data) {
          if (data === 'done') {
            observer.next({
              data: { text: 'All slides completed.' },  // Send a "done" message
            });
            observer.complete();  // End the event stream
          } else {
            observer.next({
              data: { text: data },  // Send the slide text
            });
          }
        },
        error(err) { observer.error(err); },
        complete() { observer.complete(); }
      });
  
      return () => {
        subscription.unsubscribe();
        // Optional: remove the subject if no more listeners
        // this.slideTextUpdates.delete(userId);
      };
    });
  }
  
}
