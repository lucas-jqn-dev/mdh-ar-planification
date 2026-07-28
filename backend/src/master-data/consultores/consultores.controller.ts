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
import { ConsultoresService } from './consultores.service';
import { CreateConsultorDto } from './dto/create-consultor.dto';
import { ConsultorDocument } from './schemas/consultor.schema';

@ApiTags('master-data/consultores')
@Controller('master-data/consultores')
export class ConsultoresController {
  constructor(private readonly consultoresService: ConsultoresService) {}

  @Get()
  findAll(): Promise<ConsultorDocument[]> {
    return this.consultoresService.findAll();
  }

  @Post()
  create(@Body() dto: CreateConsultorDto): Promise<ConsultorDocument> {
    return this.consultoresService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateConsultorDto,
  ): Promise<ConsultorDocument> {
    return this.consultoresService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.consultoresService.remove(id);
  }
}
