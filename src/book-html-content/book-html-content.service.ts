import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BookHtmlContent } from './entities/book-html-content.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as puppeteer from 'puppeteer';
import { BookGenerationService } from 'src/book-generation/book-generation.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class BookHtmlContentService {
    constructor(
        @InjectRepository(BookHtmlContent) // <-- Add this decorator
        private readonly bookHtmlContentRepository: Repository<BookHtmlContent>,
     private readonly configService: ConfigService,
        @Inject(forwardRef(() => BookGenerationService))
        private readonly bookGenerationService: BookGenerationService,
    
    ) {}
    findOne(id: number): Promise<BookHtmlContent> {
        return this.bookHtmlContentRepository.findOne({ where: { id } });
    }

    async generatePdf(id: number) {
      const book = await this.bookGenerationService.findOneWithHtmlContent(+id);
  
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
  
      try {
          // Create a dynamic HTML string using the book data
          const html = `
          <!DOCTYPE html>
          <html lang="${book.language || 'en'}">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${book.ideaCore}</title>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap');
                  
                  body {
                      font-family: 'Times New Roman', Times, serif;
                      margin: 0;
                      padding: 0;
                      background-color: #fffbf2;
                      color: #333;
                      line-height: 1.3;
                  }
                  .container {
                      max-width: 100%;  
                  
                  }
                  .cover {
                      display: flex;
                      flex-direction: column;
                      background: #fffbf2;
                      min-height: 100vh; /* Full viewport height */
                      width: 100%;
                      position: relative;
                      padding: 0;
                      margin: 0;
                  }
                  .cover-image {
                      width: 100%;
                      height: 75vh; /* Balance image and text */
                      overflow: hidden;
                      margin-bottom: 25px;
                  }
                  .cover-image img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                  }
                  .cover h1 {
                      font-family: 'Times New Roman', Times, serif;
                      font-size: 42px;
                      font-weight: 700;
                      color: #333;
                      margin: 10px 20px;
                      text-align: center;
                      letter-spacing: 0.5px;
                      line-height: 1.2;
                  }
                  .cover .author {
                      font-size: 24px;
                      font-style: italic;
                      color: #555;
                      margin: 15px 20px 30px;
                      text-align: center;
                      font-weight: 400;
                  }
                  h1, h2, h3 {
                      font-family: 'Times New Roman', Times, serif;
                      color: #b25800;
                  }
                  h1 {
                      font-size: 32px;
                      border-bottom: 3px solid #ffc107;
                      padding-bottom: 10px;
                      margin-top: 40px;
                  }
                  h2 {
                      font-size: 26px;
                      margin-top: 30px;
                      border-left: 4px solid #ffc107;
                      padding-left: 10px;
                  }
                  h3 {
                      font-size: 22px;
                      margin-top: 25px;
                      color: #e67e22;
                  }
                  .chapter-content {
                      text-align: justify;
                     
                      
                  }
                  .chapter-content p {
                      margin-bottom: 15px;
                  }
                  .chapter-content img {
                      padding-right: 15px;
                      max-width: 100%;
                      height: auto;
                      display: block;
                      margin: 20px 0;
                  }
                  .footer {
                      text-align: center;
                      margin-top: 40px;
                      
                      font-size: 14px;
                      color: #777;
                      border-top: 1px solid #eee;
                  }
                  .target-audience {
                      display: inline-block;
                      background-color: #ffeeba;
                      padding: 5px 10px;
                      border-radius: 20px;
                      font-size: 12px;
                      margin-top: 10px;
                  }
                  .section {
                      margin-bottom: 40px;
                      padding: 2rem 4.5rem;
                      background-color: #fffbf2;
                      border-radius: 10px;
                      border-top: 5px solid #ffc107;
                      page-break-inside: avoid;
                  }
                  @page {
                      margin-top: 30px;
                  }
                  .page-break {
                      page-break-after: always;
                  }
                  
                  .toc a {
                      color: #e67e22;
                      text-decoration: none;
                      transition: color 0.3s;
                  }
                  .toc a:hover {
                      color: #ffc107;
                      text-decoration: underline;
                  }
                  /* Enhanced Table of Contents styling */
                  .toc {
                      font-family: 'Times New Roman', Times, serif;
                      line-height: 3;
                      padding-top: 20px;
                      margin-top: 20px;
                  }
                
                 
                 
                 
                  
                  
                 
              </style>
          </head>
          <body>
              <div class="container">
                  <!-- Cover Page -->
                  <div class="cover page-break">
    <div class="cover-image">
        <img src="${this.configService.get<string>('BASE_URL')}/uploads/${book?.additionalData.coverImageUrl}" alt="${book.ideaCore}">
    </div>
                      <h1>${book.ideaCore}</h1>
                      <div class="author">By ${book?.authorName}</div>
                  </div>
                  
                  <!-- Dedication -->
                  <div class="section page-break">
                      <h2>Dedication</h2>
                      <div>${book.htmlContent?.additionalHtml?.dedication || ''}</div>
                  </div>
                  
                  <!-- Preface -->
                  <div class="section page-break">
                      <h2>Preface</h2>
                      <div>${book.htmlContent?.additionalHtml?.preface || ''}</div>
                  </div>
                  
                  <!-- Introduction -->
                  <div class="section page-break">
                      <h2>Introduction</h2>
                      <div>${book.htmlContent?.additionalHtml?.introduction || ''}</div>
                  </div>
                  
                  <!-- Table of Contents -->
                  <div class="section page-break">
                      <h2>Table of Contents</h2>
                      <div class="toc">${book.htmlContent?.additionalHtml?.tableOfContents || ''}</div>
                  </div>
                  
                
                  
                  <!-- Chapters -->
                  ${(book.htmlContent?.chaptersHtml  || []).map(chapter => `
                      <div class="section chapter-content page-break">
                          <div>${chapter.contentHtml || ''}</div>
                      </div>
                  `).join('')}
                  
                    <!-- Index -->
                  <div class="section page-break">
                      
                      <div>${book.htmlContent?.indexHtml || ''}</div>
                  </div>
                  
                  <!-- Glossary -->
                  <div class="section page-break">
                      <h2>Glossary</h2>
                      <div>${book.htmlContent?.glossaryHtml || ''}</div>
                  </div>
                  
                  <!-- References -->
                  <div class="section page-break">
                      <h2>References</h2>
                      <div>${book.htmlContent?.referencesHtml || ''}</div>
                  </div>
                  
                  <div class="footer">
                      © ${new Date().getFullYear()} | All Rights Reserved
                  </div>
              </div>
          </body>
          </html>
          `;
  
          await page.setContent(html, { waitUntil: 'networkidle0' });
          await page.emulateMediaType('screen');
  
          const pdfBuffer = await page.pdf({
              margin: { top: '40px', right: '10px', bottom: '40px', left: '10px' },
              printBackground: true,
              format: 'A4',
              displayHeaderFooter: true,
              headerTemplate: '<div style="padding-top: 5px;"></div>',
              footerTemplate: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-top: 30px; font-size: 12px; color: #777;">
                              <span style="margin-top: 20px; text-align: center;">
                                <span class="pageNumber"></span> 
                              </span>
                            </div>`,
              timeout: 0
          });
  
          if (!pdfBuffer || pdfBuffer.length === 0) {
              throw new Error('Failed to generate PDF content');
          }
  
          return {book,pdfBuffer};
      }
       finally {

          await page.close();
          await browser.close();
      }
  }
}
