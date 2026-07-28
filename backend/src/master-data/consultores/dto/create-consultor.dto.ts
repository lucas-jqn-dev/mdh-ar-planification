import {
  IsEnum,
  IsMongoId,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EquipoConsultor,
  ProveedorConsultor,
  ResponsableConsultor,
} from '../schemas/consultor.schema';

export class CreateConsultorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  nombre: string;

  @IsEnum(ProveedorConsultor)
  proveedor: ProveedorConsultor;

  @IsEnum(EquipoConsultor)
  equipo: EquipoConsultor;

  @IsEnum(ResponsableConsultor)
  responsable: ResponsableConsultor;

  @IsMongoId()
  perfilSapId: string;
}
