import { Controller, Post, Body, Req, UnauthorizedException, UseGuards, Logger, Param, Res, Sse, InternalServerErrorException, Put } from '@nestjs/common';
import { BookChapterService } from './book-chapter.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';
import { BookChapterGenerationDto, BookChapterUpdateDto } from './dto/book-chapter.dto';
import { Observable, Subject } from 'rxjs';

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
  ) {
    const userId = request.user?.id;
    this.logger.log(`Generating chapter for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      
      
      // Generate chapter and stream it via SSE
      const savedChapter = await this.bookChapterService.generateChapterOfBook( bookGenerationDto,(text:string)=>{
        this.chapterTextUpdate.next(text);
      });
      this.logger.log(`Chapter successfully generated and saved for user ID: ${userId}`);
      
       return {
        statusCode:200,
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
    this.logger.log(`Generating chapter for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('Unauthorized: User ID not found in the request.');
      throw new UnauthorizedException('Unauthorized: User ID not found in the request.');
    }

    try {
      
      
      // Generate chapter and stream it via SSE
      const savedChapter = await this.bookChapterService.updateChapter( bookGenerationDto);
      this.logger.log(`Chapter successfully generated and saved for user ID: ${userId}`);
      
       return {
        statusCode:200,
        message: 'Chapter successfully updated.',
        data: savedChapter,
      };
    } catch (error) {
      this.logger.error(`Error generating and saving chapter for user ID: ${userId}`, error.stack);
      throw new InternalServerErrorException(error.message);
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

  
}
