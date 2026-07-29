import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Oc, OcSchema } from './schemas/oc.schema';
import { OcsController } from './ocs.controller';
import { OcsService } from './ocs.service';
import { ConsultoresModule } from '../consultores/consultores.module';
import { PepsModule } from '../peps/peps.module';
import {
  Recepcion,
  RecepcionSchema,
} from '../../recepciones/schemas/recepcion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Oc.name, schema: OcSchema },
      // Registrado también acá (además de en RecepcionesModule) para que
      // OcsService pueda contar recepciones sin depender de RecepcionesModule
      // — evita el ciclo de módulos que generaría importarlo directo,
      // ya que RecepcionesModule ya importa OcsModule.
      { name: Recepcion.name, schema: RecepcionSchema },
    ]),
    ConsultoresModule,
    PepsModule,
  ],
  controllers: [OcsController],
  providers: [OcsService],
  exports: [MongooseModule],
})
export class OcsModule {}
