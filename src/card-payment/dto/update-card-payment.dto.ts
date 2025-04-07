import { PartialType } from '@nestjs/swagger';
import { CreateCardPaymentDto } from './create-card-payment.dto';

export class UpdateCardPaymentDto extends PartialType(CreateCardPaymentDto) {}
