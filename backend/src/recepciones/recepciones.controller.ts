import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RecepcionesService } from './recepciones.service';
import { CreateRecepcionDto } from './dto/create-recepcion.dto';
import { RecepcionDocument } from './schemas/recepcion.schema';

@ApiTags('recepciones')
@Controller('recepciones')
export class RecepcionesController {
  constructor(private readonly recepcionesService: RecepcionesService) {}

  @Get()
  findAll(): Promise<RecepcionDocument[]> {
    return this.recepcionesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRecepcionDto): Promise<RecepcionDocument> {
    return this.recepcionesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateRecepcionDto,
  ): Promise<RecepcionDocument> {
    return this.recepcionesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.recepcionesService.remove(id);
  }
}
