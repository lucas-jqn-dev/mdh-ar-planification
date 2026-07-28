import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Orden calendario usado tanto para el schema como para sumar el total planificado. */
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
    },
  },
})
export class Pep {
  /** Identificador de negocio del PEP (columna "PEP" del Excel), ej. "AG-MH-1164-HP-LEE-000". */
  @Prop({ required: true, trim: true, unique: true })
  pepId: string;

  @Prop({ trim: true, default: '' })
  descripcion?: string;

  @Prop({ type: PresupuestoMensualSchema, required: true, default: () => ({}) })
  presupuestoMensual: PresupuestoMensual;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PepSchema = SchemaFactory.createForClass(Pep);

PepSchema.virtual('presupuestoTotal').get(function (this: PepDocument) {
  return MESES.reduce(
    (total, mes) => total + (this.presupuestoMensual?.[mes] ?? 0),
    0,
  );
});

PepSchema.index({ pepId: 1 }, { unique: true });
