import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Oc, OcSchema } from './schemas/oc.schema';
import { OcsController } from './ocs.controller';
import { OcsService } from './ocs.service';
import { ConsultoresModule } from '../consultores/consultores.module';
import { PepsModule } from '../peps/peps.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Oc.name, schema: OcSchema }]),
    ConsultoresModule,
    PepsModule,
  ],
  controllers: [OcsController],
  providers: [OcsService],
})
export class OcsModule {}
