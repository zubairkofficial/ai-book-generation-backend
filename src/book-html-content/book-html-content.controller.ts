import {  Controller, Get, Param,  StreamableFile } from '@nestjs/common';

import { BookHtmlContentService } from './book-html-content.service';

@Controller('pdf')
export class BookHtmlContentController {
  constructor(
    private readonly bookHtmlContentService: BookHtmlContentService,
     ) {}
  @Get('generate/:id')
  async generatePdf(@Param('id') id: string): Promise<StreamableFile> {
  
    const pdfBuffer = await this.bookHtmlContentService.generatePdf(+id);
   const bookTitle = pdfBuffer.book.bookTitle;
    return new StreamableFile(pdfBuffer.pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${bookTitle}.pdf"`,
    });
  }
  
}


