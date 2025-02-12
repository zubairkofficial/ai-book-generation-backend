import { Controller, Post, Body, Req, UnauthorizedException, UseGuards, Logger, Param, Res, Sse, InternalServerErrorException } from '@nestjs/common';
import { BookChapterService } from './book-chapter.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';
import { BookChapterGenerationDto } from './dto/book-chapter.dto';
import { Observable, Subject } from 'rxjs';
// import { Response } from 'express';

@Controller('book-chapter')
export class BookChapterController {
  private readonly logger = new Logger(BookChapterController.name);
private chapterTextUpdate=new Subject<string>()
  constructor(private readonly bookChapterService: BookChapterService) {}

  @UseGuards(JwtAuthGuard)
  @Post('chapter/create')
  async generateChapterOfBook(
    @Body() bookGenerationDto: BookChapterGenerationDto,
    @Req() request: RequestWithUser,
    // @Res() response: any
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating chapter for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      
        // response.status(200).send("OK");
      
      // Generate chapter and stream it via SSE
      const savedChapter = await this.bookChapterService.generateChapterOfBook(userId, bookGenerationDto,(text:string)=>{
        this.chapterTextUpdate.next(text);
      });
      this.logger.log(`Chapter successfully generated and saved for user ID: ${userId}`);
      
      // Trigger SSE streaming for real-time updates
      // await this.bookChapterService.streamChapterContent(bookGenerationDto, savedChapter.bookGeneration);
      return {
        message: 'Chapter successfully generated and saved.',
        data: savedChapter,
      };
    } catch (error) {
      this.logger.error(`Error generating and saving chapter for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException('An error occurred while generating and saving the chapter.');
    }
  }
  @Sse('chapter-stream')
   streamChapter():Observable<{data:{text:string}}>{
return new Observable((observer)=>{
const subscribe=this.chapterTextUpdate.subscribe({
  next(data){observer.next({
    data:{text:data}
  })},
  error(err){observer.error(err)},
  complete(){observer.complete()}
 
})
return ()=>subscribe.unsubscribe()
})
  }

  // @Sse('chapter-stream/:bookId/:chapterNo')
  // async streamChapter(
  //   @Param() params: { bookId: string; chapterNo: number },
  //   @Res() res: Response,
  // ) {
  //   const book = await this.bookChapterService.getBook(+params.bookId);
  //   const input = {
  //     bookGenerationId: +params.bookId,
  //     chapterNo: params.chapterNo,
  //   };

  //   // Retrieve and stream chapter content using SSE
  //   const observable = await this.bookChapterService.streamChapterContent(input, book);

  //   // Set necessary headers for SSE
  //   res.setHeader('Content-Type', 'text/event-stream');
  //   res.setHeader('Cache-Control', 'no-cache');
  //   res.setHeader('Connection', 'keep-alive');

  //   return observable.pipe(
  //     map((data) => ({ data })),
  //     catchError((error) => of({ error })) // Wrap the object with 'of'
  //   );
  // }
}
