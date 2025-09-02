import { CreateTripMoneyInput } from './create-trip-money.input';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateTripMoneyInput extends PartialType(CreateTripMoneyInput) {
  id: number;
}
