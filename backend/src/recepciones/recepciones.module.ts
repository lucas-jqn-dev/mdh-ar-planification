import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Recepcion, RecepcionSchema } from './schemas/recepcion.schema';
import { RecepcionesController } from './recepciones.controller';
import { RecepcionesService } from './recepciones.service';
import { OcsModule } from '../master-data/ocs/ocs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recepcion.name, schema: RecepcionSchema },
    ]),
    OcsModule,
  ],
  controllers: [RecepcionesController],
  providers: [RecepcionesService],
})
export class RecepcionesModule {}
