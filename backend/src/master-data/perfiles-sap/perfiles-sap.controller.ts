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
import { PerfilesSapService } from './perfiles-sap.service';
import { CreatePerfilSapDto } from './dto/create-perfil-sap.dto';
import { PerfilSapDocument } from './schemas/perfil-sap.schema';

@ApiTags('master-data/perfiles-sap')
@Controller('master-data/perfiles-sap')
export class PerfilesSapController {
  constructor(private readonly perfilesSapService: PerfilesSapService) {}

  @Get()
  findAll(): Promise<PerfilSapDocument[]> {
    return this.perfilesSapService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePerfilSapDto): Promise<PerfilSapDocument> {
    return this.perfilesSapService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreatePerfilSapDto,
  ): Promise<PerfilSapDocument> {
    return this.perfilesSapService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.perfilesSapService.remove(id);
  }
}
