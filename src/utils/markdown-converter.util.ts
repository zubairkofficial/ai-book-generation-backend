// src/common/utils/markdown-converter.util.ts
import { Injectable } from '@nestjs/common';
import { marked } from 'marked';

@Injectable()
export class MarkdownConverter {
  convert(markdown: string){
    return marked.parse(markdown);
  }
}