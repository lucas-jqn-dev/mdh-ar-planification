import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Recepcion, RecepcionSchema } from './schemas/recepcion.schema';
import { RecepcionesController } from './recepciones.controller';
import { RecepcionesService } from './recepciones.service';
import { OcsModule } from '../master-data/ocs/ocs.module';
import { ConsultoresModule } from '../master-data/consultores/consultores.module';
import { PepsModule } from '../master-data/peps/peps.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recepcion.name, schema: RecepcionSchema },
    ]),
    OcsModule,
    // Para inyectar Model<ConsultorDocument> (tarifa hora) y
    // Model<SaldoPepDocument> (sincronizar realMensual) en
    // RecepcionesService — mismo patrón que ya usa OcsModule para poder
    // inyectar esos mismos modelos.
    ConsultoresModule,
    PepsModule,
  ],
  controllers: [RecepcionesController],
  providers: [RecepcionesService],
})
export class RecepcionesModule {}
