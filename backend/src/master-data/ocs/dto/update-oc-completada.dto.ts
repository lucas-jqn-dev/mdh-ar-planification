import { IsBoolean } from 'class-validator';

export class UpdateOcCompletadaDto {
  @IsBoolean()
  completada: boolean;
}
