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
import { OcsService } from './ocs.service';
import { CreateOcDto } from './dto/create-oc.dto';
import { UpdateOcCompletadaDto } from './dto/update-oc-completada.dto';
import { OcDocument } from './schemas/oc.schema';

@ApiTags('master-data/ocs')
@Controller('master-data/ocs')
export class OcsController {
  constructor(private readonly ocsService: OcsService) {}

  @Get()
  findAll(): Promise<OcDocument[]> {
    return this.ocsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateOcDto): Promise<OcDocument> {
    return this.ocsService.create(dto);
  }

  @Patch(':id/completada')
  setCompletada(
    @Param('id') id: string,
    @Body() dto: UpdateOcCompletadaDto,
  ): Promise<OcDocument> {
    return this.ocsService.setCompletada(id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateOcDto,
  ): Promise<OcDocument> {
    return this.ocsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.ocsService.remove(id);
  }
}
