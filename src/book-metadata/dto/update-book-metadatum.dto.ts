import { PartialType } from '@nestjs/swagger';
import { CreateBookMetadatumDto } from './create-book-metadatum.dto';

export class UpdateBookMetadatumDto extends PartialType(CreateBookMetadatumDto) {}
