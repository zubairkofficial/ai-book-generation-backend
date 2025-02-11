import { Injectable } from '@nestjs/common';
import { CreateBookMetadatumDto } from './dto/create-book-metadatum.dto';
import { UpdateBookMetadatumDto } from './dto/update-book-metadatum.dto';

@Injectable()
export class BookMetadataService {
  create(createBookMetadatumDto: CreateBookMetadatumDto) {
    return 'This action adds a new bookMetadatum';
  }

  findAll() {
    return `This action returns all bookMetadata`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bookMetadatum`;
  }

  update(id: number, updateBookMetadatumDto: UpdateBookMetadatumDto) {
    return `This action updates a #${id} bookMetadatum`;
  }

  remove(id: number) {
    return `This action removes a #${id} bookMetadatum`;
  }
}
