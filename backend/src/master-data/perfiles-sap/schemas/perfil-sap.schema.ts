import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProveedorConsultor } from '../../consultores/schemas/consultor.schema';

export type PerfilSapDocument = HydratedDocument<PerfilSap>;

@Schema({
  timestamps: true,
  collection: 'perfiles_sap',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
    },
  },
})
export class PerfilSap {
  /** Código SAP del perfil (columna "CODIGO SAP" del Excel), ej. "8006521". */
  @Prop({ required: true, trim: true, unique: true })
  codigoSap: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  @Prop({ type: Number, required: true, min: 0 })
  tarifaHora: number;

  @Prop({ type: String, enum: ProveedorConsultor, required: true })
  proveedor: ProveedorConsultor;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PerfilSapSchema = SchemaFactory.createForClass(PerfilSap);

PerfilSapSchema.index({ codigoSap: 1 }, { unique: true });
