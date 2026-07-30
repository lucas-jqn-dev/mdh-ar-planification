import { Module } from '@nestjs/common';
import { OcsModule } from '../master-data/ocs/ocs.module';
import { DescargasController } from './descargas.controller';
import { DescargasService } from './descargas.service';

@Module({
  // OcsModule exporta MongooseModule con Oc registrado — alcanza para poder
  // inyectar Model<OcDocument> con populate a Pep/Consultor.perfilSap (esos
  // schemas ya quedan registrados globalmente en la conexión de Mongoose vía
  // PepsModule/ConsultoresModule, cargados por MasterDataModule).
  imports: [OcsModule],
  controllers: [DescargasController],
  providers: [DescargasService],
})
export class DescargasModule {}
