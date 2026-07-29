import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  Pep,
  PresupuestoMensual,
  PresupuestoMensualSchema,
} from './pep.schema';

export type SaldoPepDocument = HydratedDocument<SaldoPep>;

@Schema({
  timestamps: true,
  collection: 'saldos_peps',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
    },
  },
})
export class SaldoPep {
  /**
   * PEP al que pertenece este saldo (ref a Pep) — lado "dueño" de la
   * relación con `Pep.saldoActual` (populate virtual reverso).
   */
  @Prop({ type: Types.ObjectId, ref: Pep.name, required: true })
  pep: Types.ObjectId;

  /** Inicio de validez del saldo, formato "YYYY-MM-DD" — 1 de enero del año en curso al crearse. */
  @Prop({ required: true })
  validezDesde: string;

  /** Fin de validez del saldo, formato "YYYY-MM-DD" — 31 de diciembre del año en curso al crearse. */
  @Prop({ required: true })
  validezHasta: string;

  /** Presupuesto planificado mensual — lo único que se edita hoy desde el ABM de PEPs. */
  @Prop({ type: PresupuestoMensualSchema, required: true, default: () => ({}) })
  forecastMensual: PresupuestoMensual;

  /** Asignado mensual — reservado para un flujo futuro, ningún ABM lo carga todavía. */
  @Prop({ type: PresupuestoMensualSchema, required: true, default: () => ({}) })
  asignacionMensual: PresupuestoMensual;

  /** Real mensual — reservado para un flujo futuro, ningún ABM lo carga todavía. */
  @Prop({ type: PresupuestoMensualSchema, required: true, default: () => ({}) })
  realMensual: PresupuestoMensual;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SaldoPepSchema = SchemaFactory.createForClass(SaldoPep);

SaldoPepSchema.index({ pep: 1 });
