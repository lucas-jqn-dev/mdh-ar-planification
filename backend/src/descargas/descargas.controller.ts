import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DescargasService } from './descargas.service';
import { SOLICITUD_LIBERACION_FILE_NAME } from './solicitud-liberacion.workbook';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('descargas')
@Controller('descargas')
export class DescargasController {
  constructor(private readonly descargasService: DescargasService) {}

  @Get('solicitud-liberacion')
  async solicitudLiberacion(@Res() res: Response): Promise<void> {
    const buffer = await this.descargasService.generarSolicitudLiberacion();

    if (!buffer) {
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }

    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${SOLICITUD_LIBERACION_FILE_NAME}"`,
    });
    res.send(buffer);
  }
}
