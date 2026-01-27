import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BookHtmlContent } from './entities/book-html-content.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as puppeteer from 'puppeteer';
import { BookGenerationService } from 'src/book-generation/book-generation.service';
import { ConfigService } from '@nestjs/config';
import * as pdfLib from 'pdfjs-lib';
import { marked } from 'marked';
@Injectable()
export class BookHtmlContentService {
  constructor(
    @InjectRepository(BookHtmlContent) // <-- Add this decorator
    private readonly bookHtmlContentRepository: Repository<BookHtmlContent>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BookGenerationService))
    private readonly bookGenerationService: BookGenerationService,

  ) { }
  findOne(id: number): Promise<BookHtmlContent> {
    return this.bookHtmlContentRepository.findOne({ where: { id } });
  }

  async generatePdf(id: number) {
    const book = await this.bookGenerationService.findOneWithHtmlContent(+id);

    let browser;
    try {
      // Launch browser with proper configuration
      const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH') || undefined;
      console.log(`Launching Puppeteer. Executable Path: ${executablePath || 'Auto-bundled'}, Timeout: 0`);

      browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Critical for Docker/Linux containers
          '--disable-gpu',
          '--disable-extensions',
        ],
        timeout: 0, // No timeout for long generation
      });

      const page = await browser.newPage();

      // Step 1: Generate initial HTML without TOC for page number calculation
      const initialHtml = this.generateBookHtml(book, false);
      await page.setContent(initialHtml, { waitUntil: 'domcontentloaded', timeout: 0 });
      await page.emulateMediaType('screen');

      // Step 2: Calculate page numbers for chapters
      const chapterPageNumbers = await this.calculateChapterPageNumbers(page, book);

      // Step 3: Generate final HTML with accurate TOC
      const finalHtml = this.generateBookHtml(book, true, chapterPageNumbers);
      await page.setContent(finalHtml, { waitUntil: 'domcontentloaded', timeout: 0 });
      await page.emulateMediaType('screen');

      // Step 4: Generate PDF with proper page numbering
      let pdfBuffer = await page.pdf({
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
        timeout: 0,
        outline: true
      });

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Failed to generate PDF content');
      }

      const pdfPromise = pdfLib.getDocument(pdfBuffer)
      const pdf = await pdfPromise.promise
      const outline = await pdf.getOutline();
      const tocPageNumbers = [];

      for (const item of outline) {
        if (item.title === 'Table of Contents') continue;
        const pageIndex = await pdf.getPageIndex(item.dest[0]);
        tocPageNumbers.push({
          title: item.title,
          pageNumber: pageIndex + 1 // PDF pages are 0-indexed
        });
      }

      // Regenerate PDF with updated TOC
      if (tocPageNumbers.length > 0) {
        const finalHtml = this.generateBookHtml(book, true, tocPageNumbers);
        await page.setContent(finalHtml, { waitUntil: 'domcontentloaded', timeout: 0 });
        pdfBuffer = await page.pdf(
          {
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
            timeout: 0,
            outline: true
          }
        );
      }

      await page.close();
      return { book, pdfBuffer };

    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async calculateChapterPageNumbers(page: puppeteer.Page, book: any) {
    // Evaluate on the page to get chapter elements and calculate their page numbers
    // Evaluate on the page to only get page numbers based on ID
    const pageNumbers = await page.evaluate(() => {
      const chapterElements = document.querySelectorAll('.chapter-content');
      const A4_HEIGHT = 1122; // A4 height in pixels at 96dpi
      const PDF_MARGIN_TOP = 40;

      return Array.from(chapterElements).map((element, index) => {
        const rect = element.getBoundingClientRect();
        const positionFromTop = rect.top + window.pageYOffset;
        const pageNumber = Math.floor((positionFromTop - PDF_MARGIN_TOP) / A4_HEIGHT) + 1;

        return {
          id: `chapter-${index + 1}`,
          pageNumber
        };
      });
    });

    // Merge with correct chapter titles from DB
    return pageNumbers.map((item, index) => {
      const chapter = book.bookChapter && book.bookChapter.find(c => c.chapterNo === (index + 1));
      return {
        ...item,
        title: chapter ? `Chapter ${chapter.chapterNo}: ${chapter.chapterName}` : `Chapter ${index + 1}`
      };
    });
  }

  private generateBookHtml(book: any, includeToc: boolean = true, chapterPageNumbers = []) {
    return `
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
                  line-height: 1.4;
              }
              .container {
                  max-width: 100%;
              }
              .cover {
                  display: flex;
                  flex-direction: column;
                  background: #fffbf2;
                  min-height: 100vh;
                  width: 100%;
                  position: relative;
                  padding: 0;
                  margin: 0;
              }
              .cover-image {
                  width: 100%;
                  height: 75vh;
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
              .chapter-content p:first-of-type::first-letter {
                  float: left;
                  font-size: 4em;
                  line-height: 0.8;
                  padding-right: 0.1em;
                  padding-top: 0.1em;
                  color: #b25800;
                  font-family: 'Playfair Display', serif;
              }
              .section p:first-of-type::first-letter {
                  float: left;
                  font-size: 4em;
                  line-height: 0.8;
                  padding-right: 0.1em;
                  padding-top: 0.1em;
                  color: #b25800;
                  font-family: 'Playfair Display', serif;
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
                  padding-top:20px
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

              /* New TOC styles */
              .toc-entry {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  border-bottom: 1px dotted #ccc;
                  margin-bottom: 8px;
                  line-height: 1.4;
              }
              .toc-entry a {
                  flex: 1;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  margin-right: 15px;
                  text-decoration: none;
                  color: inherit;
              }
              .toc-page-number {
                  font-weight: bold;
                  white-space: nowrap;
                  align-self: flex-end;
                  margin-bottom: 2px;
              }
              .index-entry {
                  margin-bottom: 20px;
                  page-break-inside: avoid;
              }
              .index-entry h3 {
                  font-size: 18px;
                  color: #333;
                  margin-bottom: 8px;
                  border-bottom: 1px solid #ffc107;
                  display: inline-block;
              }
              .index-content {
                  font-size: 14px;
                  line-height: 1.6;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <!-- Cover Page -->
              <div class="cover page-break">
                <div class="cover-image">
                    <img src="${this.configService.get<string>('BASE_URL')}/uploads/${book?.additionalData.coverImageUrl}" alt="${book.bookTitle}">
                </div>
                <h1 style="font-size: ${(book.bookTitle || '').length > 60 ? '24px' : ((book.bookTitle || '').length > 30 ? '32px' : '42px')}">${book.bookTitle}</h1>
                ${book.genre ? `<div style="font-size: 18px; color: #666; font-style: italic; margin-bottom: 20px;">${book.genre}</div>` : ''}
                <div class="author">By ${book?.authorName}</div>
                ${book.ideaCore && (book.bookTitle || '').length < 100 ? `<div style="font-size: 14px; color: #777; margin: 20px 40px; text-align: center; line-height: 1.5;">${book.ideaCore}</div>` : ''}
              </div>

              <!-- Dedication -->
              <div class="section page-break">
                  <h2>Dedication</h2>
                  <p>${book.htmlContent?.additionalHtml?.dedication || ''}</p>
              </div>

              <!-- Preface -->
              <div class="section page-break">
                  <h2>Preface</h2>
                  <p>${book.htmlContent?.additionalHtml?.preface || ''}</p>
              </div>


              <!-- Introduction -->
              <div class="section page-break">
                  <h2>Introduction</h2>
                  <p>${book.htmlContent?.additionalHtml?.introduction || ''}</p>
              </div>

              ${includeToc ? this.generateTableOfContents(chapterPageNumbers) : ''}

              <!-- Index -->
              <div class="section page-break">
                  <h2>Index</h2> 
                  <div class="index-content">
                    ${(book.bookChapter || []).sort((a, b) => a.chapterNo - b.chapterNo).map(chapter => `
                      <div class="index-entry">
                        <h3>Chapter ${chapter.chapterNo}: ${chapter.chapterName || ''}</h3>
                        <div>${chapter.chapterSummary ? marked.parse(chapter.chapterSummary) : 'Summary not available.'}</div>
                      </div>
                    `).join('')}
                  </div>
              </div>

              <!-- Chapters -->
              ${(book.htmlContent?.chaptersHtml || []).map((chapter, index) => {
      const chapterData = book.bookChapter && book.bookChapter.find(c => c.chapterNo === (index + 1));
      const chapterName = chapterData ? chapterData.chapterName : `Chapter ${index + 1}`;
      return `
                      <div id="chapter-${index + 1}" class="section chapter-content page-break">
                          <h1>Chapter ${index + 1}: ${chapterName}</h1>
                          <div>${chapter.contentHtml || ''}</div>
                      </div>
                  `;
    }).join('')}

              <!-- References -->
              <div class="section page-break">
                  <h2>References</h2>
                  <p>${book.htmlContent?.referencesHtml || ''}</p>
              </div>

              <div class="footer">
                  © ${new Date().getFullYear()} | All Rights Reserved
              </div>
          </div>
      </body>
      </html>
      `;
  }

  private generateTableOfContents(chapterPageNumbers) {
    if (!chapterPageNumbers || chapterPageNumbers.length === 0) {
      return '';
    }

    const tocEntries = chapterPageNumbers.map(chapter =>
      `<div class="toc-entry">
            <a href="#${chapter.id}">${chapter.title}</a>
            <span class="toc-page-number">Page ${chapter.pageNumber}</span>
          </div>`
    ).join('');

    return `
        <div class="section page-break" id="toc-section">
          <h2>Table of Contents</h2>
          <div class="toc">
            ${tocEntries}
          </div>
        </div>`;
  }
}
