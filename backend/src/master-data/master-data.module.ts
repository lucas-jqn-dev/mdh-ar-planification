import { Module } from '@nestjs/common';
import { ConsultoresModule } from './consultores/consultores.module';
import { PepsModule } from './peps/peps.module';

/**
 * Agrupa los sub-módulos de Datos Maestros (Consultores, PEPs, y a futuro OC).
 */
@Module({
  imports: [ConsultoresModule, PepsModule],
})
export class MasterDataModule {}
