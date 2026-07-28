import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProveedorConsultor } from '../../consultores/schemas/consultor.schema';

export class CreatePerfilSapDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  codigoSap: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  descripcion: string;

  @IsNumber()
  @Min(0)
  tarifaHora: number;

  @IsEnum(ProveedorConsultor)
  proveedor: ProveedorConsultor;
}
