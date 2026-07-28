import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PerfilSap, PerfilSapSchema } from './schemas/perfil-sap.schema';
import { PerfilesSapController } from './perfiles-sap.controller';
import { PerfilesSapService } from './perfiles-sap.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PerfilSap.name, schema: PerfilSapSchema },
    ]),
  ],
  controllers: [PerfilesSapController],
  providers: [PerfilesSapService],
  exports: [MongooseModule],
})
export class PerfilesSapModule {}
