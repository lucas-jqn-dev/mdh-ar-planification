import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pep, PepSchema } from './schemas/pep.schema';
import { SaldoPep, SaldoPepSchema } from './schemas/saldo-pep.schema';
import { PepsController } from './peps.controller';
import { PepsService } from './peps.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pep.name, schema: PepSchema },
      { name: SaldoPep.name, schema: SaldoPepSchema },
    ]),
  ],
  controllers: [PepsController],
  providers: [PepsService],
  exports: [MongooseModule],
})
export class PepsModule {}
