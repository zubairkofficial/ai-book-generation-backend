import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BgrService } from './bgr.service';

@Controller('bgr')
export class BgrController {
  constructor(private readonly bgrService: BgrService) {}

  
}
