import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Consultor, ConsultorSchema } from './schemas/consultor.schema';
import { ConsultoresController } from './consultores.controller';
import { ConsultoresService } from './consultores.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultor.name, schema: ConsultorSchema },
    ]),
  ],
  controllers: [ConsultoresController],
  providers: [ConsultoresService],
})
export class ConsultoresModule {}
