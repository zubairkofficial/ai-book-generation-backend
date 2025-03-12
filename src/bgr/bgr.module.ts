import { Module } from '@nestjs/common';
import { BgrService } from './bgr.service';
import { BgrController } from './bgr.controller';

@Module({
  controllers: [BgrController],
  providers: [BgrService],
})
export class BgrModule {}
