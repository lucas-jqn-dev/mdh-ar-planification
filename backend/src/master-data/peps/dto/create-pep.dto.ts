import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
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

  @ValidateNested()
  @Type(() => PresupuestoMensualDto)
  presupuestoMensual: PresupuestoMensualDto;
}
