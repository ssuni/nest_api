import { CreateMainModelInput } from './create-main_model.input';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateMainModelInput extends PartialType(CreateMainModelInput) {
  id: number;
}
