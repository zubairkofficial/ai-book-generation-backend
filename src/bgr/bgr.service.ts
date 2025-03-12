import { Injectable } from '@nestjs/common';
import { CreateBgrDto } from './dto/create-bgr.dto';
import { UpdateBgrDto } from './dto/update-bgr.dto';

@Injectable()
export class BgrService {
  create(createBgrDto: CreateBgrDto) {
    return 'This action adds a new bgr';
  }

  findAll() {
    return `This action returns all bgr`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bgr`;
  }

  update(id: number, updateBgrDto: UpdateBgrDto) {
    return `This action updates a #${id} bgr`;
  }

  remove(id: number) {
    return `This action removes a #${id} bgr`;
  }
}
