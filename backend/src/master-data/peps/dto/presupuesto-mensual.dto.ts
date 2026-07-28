import { IsNumber, Min } from 'class-validator';

export class PresupuestoMensualDto {
  @IsNumber()
  @Min(0)
  enero: number;

  @IsNumber()
  @Min(0)
  febrero: number;

  @IsNumber()
  @Min(0)
  marzo: number;

  @IsNumber()
  @Min(0)
  abril: number;

  @IsNumber()
  @Min(0)
  mayo: number;

  @IsNumber()
  @Min(0)
  junio: number;

  @IsNumber()
  @Min(0)
  julio: number;

  @IsNumber()
  @Min(0)
  agosto: number;

  @IsNumber()
  @Min(0)
  septiembre: number;

  @IsNumber()
  @Min(0)
  octubre: number;

  @IsNumber()
  @Min(0)
  noviembre: number;

  @IsNumber()
  @Min(0)
  diciembre: number;
}
