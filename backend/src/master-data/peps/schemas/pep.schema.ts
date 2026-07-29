import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { normalizePopulatedRef } from '../../shared/normalize-populated-ref.util';

/** Orden calendario usado por PresupuestoMensual — reusado por Oc y SaldoPep. */
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export type Mes = (typeof MESES)[number];

export enum PaisPep {
  ARGENTINA = 'Argentina',
  COLOMBIA = 'Colombia',
}

@Schema({ _id: false })
export class PresupuestoMensual {
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  enero: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  febrero: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  marzo: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  abril: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  mayo: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  junio: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  julio: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  agosto: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  septiembre: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  octubre: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  noviembre: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  diciembre: number;
}

export const PresupuestoMensualSchema =
  SchemaFactory.createForClass(PresupuestoMensual);

export type PepDocument = HydratedDocument<Pep>;

@Schema({
  timestamps: true,
  collection: 'peps',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      normalizePopulatedRef(ret.saldoActual);
    },
  },
})
export class Pep {
  /** Identificador de negocio del PEP (columna "PEP" del Excel), ej. "AG-MH-1164-HP-LEE-000". */
  @Prop({ required: true, trim: true, unique: true })
  pepId: string;

  @Prop({ trim: true, default: '' })
  descripcion?: string;

  @Prop({ type: String, enum: PaisPep, required: true })
  pais: PaisPep;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PepSchema = SchemaFactory.createForClass(Pep);

/**
 * Populate virtual (reverso): el saldo mensual (forecast/asignación/real)
 * de este PEP vive en la colección separada `saldos_peps`
 * (`SaldoPep.pep` es el lado "dueño" de la relación, no `Pep`). Se
 * referencia por nombre de modelo ('SaldoPep', string) en vez de importar
 * la clase, para no crear un ciclo de import con `saldo-pep.schema.ts`
 * (que sí importa `Pep`/`PresupuestoMensual` desde acá). `justOne: true`
 * porque hoy cada PEP tiene un único saldo activo — no hay todavía soporte
 * de múltiples períodos de validez por PEP.
 */
PepSchema.virtual('saldoActual', {
  ref: 'SaldoPep',
  localField: '_id',
  foreignField: 'pep',
  justOne: true,
});

PepSchema.index({ pepId: 1 }, { unique: true });
