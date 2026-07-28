import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PerfilSap } from '../../perfiles-sap/schemas/perfil-sap.schema';
import { normalizePopulatedRef } from '../../shared/normalize-populated-ref.util';

/**
 * Valores iniciales tomados de la solapa "1- Consultores" del planificador
 * Excel. Son ajustables: agregar/quitar miembros del enum a medida que
 * cambien los proveedores, equipos o responsables reales.
 */
export enum ProveedorConsultor {
  ADVANCED = 'ADVANCED',
  BRIGHTSIDE = 'BRIGHTSIDE',
  FRICE = 'FRICE',
  MAGNO = 'MAGNO',
  NEORIS = 'NEORIS',
  RRHH_Y_SOL_TEC = 'RRHH Y SOL. TEC',
}

export enum EquipoConsultor {
  COMERCIAL = 'Comercial',
  I_MAS_D = 'I+D',
  PROY = 'Proyectos',
  SUPPLY = 'Supply',
}

export enum ResponsableConsultor {
  ARIEL = 'Ariel',
  LUCAS = 'Lucas',
  NATALIA = 'Natalia',
  SANTIAGO = 'Santiago',
}

export type ConsultorDocument = HydratedDocument<Consultor>;

@Schema({
  timestamps: true,
  collection: 'consultores',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      normalizePopulatedRef(ret.perfilSap);
    },
  },
})
export class Consultor {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ type: String, enum: ProveedorConsultor, required: true })
  proveedor: ProveedorConsultor;

  @Prop({ type: String, enum: EquipoConsultor, required: true })
  equipo: EquipoConsultor;

  @Prop({ type: String, enum: ResponsableConsultor, required: true })
  responsable: ResponsableConsultor;

  /** Perfil SAP asignado al consultor (ref a PerfilSap), obligatorio. */
  @Prop({ type: Types.ObjectId, ref: PerfilSap.name, required: true })
  perfilSap: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ConsultorSchema = SchemaFactory.createForClass(Consultor);
