import { Module } from '@nestjs/common';
import { ConsultoresModule } from './consultores/consultores.module';
import { PepsModule } from './peps/peps.module';
import { PerfilesSapModule } from './perfiles-sap/perfiles-sap.module';
import { OcsModule } from './ocs/ocs.module';

/**
 * Agrupa los sub-módulos de Datos Maestros (Perfiles SAP, Consultores, PEPs, OC).
 */
@Module({
  imports: [PerfilesSapModule, ConsultoresModule, PepsModule, OcsModule],
})
export class MasterDataModule {}
