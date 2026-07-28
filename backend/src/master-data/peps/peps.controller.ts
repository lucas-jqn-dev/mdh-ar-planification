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
import { PepsService } from './peps.service';
import { CreatePepDto } from './dto/create-pep.dto';
import { PepDocument } from './schemas/pep.schema';

@ApiTags('master-data/peps')
@Controller('master-data/peps')
export class PepsController {
  constructor(private readonly pepsService: PepsService) {}

  @Get()
  findAll(): Promise<PepDocument[]> {
    return this.pepsService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePepDto): Promise<PepDocument> {
    return this.pepsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreatePepDto,
  ): Promise<PepDocument> {
    return this.pepsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.pepsService.remove(id);
  }
}
