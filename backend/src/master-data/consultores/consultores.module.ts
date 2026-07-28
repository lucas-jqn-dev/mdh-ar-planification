import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Consultor, ConsultorSchema } from './schemas/consultor.schema';
import { ConsultoresController } from './consultores.controller';
import { ConsultoresService } from './consultores.service';
import { PerfilesSapModule } from '../perfiles-sap/perfiles-sap.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultor.name, schema: ConsultorSchema },
    ]),
    PerfilesSapModule,
  ],
  controllers: [ConsultoresController],
  providers: [ConsultoresService],
  exports: [MongooseModule],
})
export class ConsultoresModule {}
