import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BookMetadataService } from './book-metadata.service';
import { CreateBookMetadatumDto } from './dto/create-book-metadatum.dto';
import { UpdateBookMetadatumDto } from './dto/update-book-metadatum.dto';

@Controller('book-metadata')
export class BookMetadataController {
  constructor(private readonly bookMetadataService: BookMetadataService) {}

  @Post()
  create(@Body() createBookMetadatumDto: CreateBookMetadatumDto) {
    return this.bookMetadataService.create(createBookMetadatumDto);
  }

  @Get()
  findAll() {
    return this.bookMetadataService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookMetadataService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookMetadatumDto: UpdateBookMetadatumDto) {
    return this.bookMetadataService.update(+id, updateBookMetadatumDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookMetadataService.remove(+id);
  }
}
