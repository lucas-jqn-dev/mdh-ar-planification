import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MES_ANIO_REGEX } from '../../master-data/ocs/schemas/oc.schema';

export class CreateRecepcionDto {
  /** ObjectId de Mongo de la OC (posición) recepcionada. */
  @IsMongoId()
  ocId: string;

  @Matches(MES_ANIO_REGEX, { message: 'mes debe tener formato YYYY-MM' })
  mes: string;

  @IsNumber()
  @IsPositive()
  horasRecepcionadas: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  documento103: string;
}
