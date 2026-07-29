import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaisPep } from '../schemas/pep.schema';
import { PresupuestoMensualDto } from './presupuesto-mensual.dto';

export class CreatePepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  pepId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  descripcion?: string;

  @IsEnum(PaisPep)
  pais: PaisPep;

  /** Presupuesto planificado mensual — se guarda en `SaldoPep.forecastMensual`, no en el propio Pep. */
  @ValidateNested()
  @Type(() => PresupuestoMensualDto)
  forecastMensual: PresupuestoMensualDto;
}
