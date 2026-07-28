import { Transform } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MES_ANIO_REGEX } from '../schemas/oc.schema';

export class CreateOcDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  solped: string;

  @IsInt()
  @Min(0)
  posicion: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  numeroOc?: string;

  /** ObjectId de Mongo del Pep (no confundir con `Pep.pepId`, el código de negocio del Excel). */
  @IsMongoId()
  pepId: string;

  @IsNumber()
  @Min(0)
  cantidadHoras: number;

  /** ObjectId de Mongo del Consultor. */
  @IsMongoId()
  consultorId: string;

  @Matches(MES_ANIO_REGEX, { message: 'mesDesde debe tener formato YYYY-MM' })
  mesDesde: string;

  @Matches(MES_ANIO_REGEX, { message: 'mesHasta debe tener formato YYYY-MM' })
  mesHasta: string;
}
