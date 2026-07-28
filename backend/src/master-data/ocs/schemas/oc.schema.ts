import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Consultor } from '../../consultores/schemas/consultor.schema';
import {
  Pep,
  PresupuestoMensual,
  PresupuestoMensualSchema,
} from '../../peps/schemas/pep.schema';
import { normalizePopulatedRef } from '../../shared/normalize-populated-ref.util';

export type OcDocument = HydratedDocument<Oc>;

/** Formato "YYYY-MM" (año-mes), sin día — ver `mesDesde`/`mesHasta`. */
export const MES_ANIO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

@Schema({
  timestamps: true,
  collection: 'ordenes_compra',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;

      normalizePopulatedRef(ret.pep);

      const consultor = ret.consultor;
      normalizePopulatedRef(consultor);
      if (consultor && typeof consultor === 'object') {
        normalizePopulatedRef((consultor as Record<string, unknown>).perfilSap);
      }
    },
  },
})
export class Oc {
  /** Número de SolPed (columna "SolPed" del Excel), ej. "7900043501". */
  @Prop({ required: true, trim: true })
  solped: string;

  /** Posición de la OC dentro del SolPed (columna "OC Pos."), ej. 10, 20, 30. */
  @Prop({ type: Number, required: true, min: 0 })
  posicion: number;

  /** Número de OC (columna "OC"), opcional: puede no existir todavía al cargar la posición. */
  @Prop({ trim: true, default: '' })
  numeroOc?: string;

  /** PEP contra el que se imputa esta posición (ref a Pep). */
  @Prop({ type: Types.ObjectId, ref: Pep.name, required: true })
  pep: Types.ObjectId;

  /** Cantidad de horas del período (columna "OC Total Hs. Periodo"). */
  @Prop({ type: Number, required: true, min: 0 })
  cantidadHoras: number;

  /**
   * Mes de inicio de validez de la OC (columna "Validez OC" / "F. Desde"
   * del Excel, simplificado a granularidad de mes), formato "YYYY-MM".
   */
  @Prop({ required: true, match: MES_ANIO_REGEX })
  mesDesde: string;

  /** Mes de fin de validez de la OC ("F. Hasta" del Excel), formato "YYYY-MM". */
  @Prop({ required: true, match: MES_ANIO_REGEX })
  mesHasta: string;

  /**
   * Consultor asignado (ref a Consultor). Perfil SAP, tarifa hora,
   * proveedor y responsable se derivan siempre en vivo desde el Consultor
   * (y su Perfil SAP) poblado — no se snapshotean acá.
   */
  @Prop({ type: Types.ObjectId, ref: Consultor.name, required: true })
  consultor: Types.ObjectId;

  /** Estado de la posición: pendiente (default) o completada. Se togglea desde la tabla, no desde el alta/edición. */
  @Prop({ type: Boolean, required: true, default: false })
  completada: boolean;

  /**
   * Distribución mensual del monto total de la posición (tarifaHora del
   * Consultor × cantidadHoras), repartido en partes iguales entre los meses
   * de mesDesde/mesHasta (ambos inclusive). Se recalcula por completo en
   * cada create/update en `OcsService`, nunca se edita a mano. Reusa el
   * mismo shape que `Pep.presupuestoMensual` (12 props enero..diciembre,
   * sin año) — un rango que cruza fin de año no distingue el año, solo
   * repite el mismo mes (limitación consciente, igual que en Pep).
   */
  @Prop({ type: PresupuestoMensualSchema, required: true, default: () => ({}) })
  presupuestoMensual: PresupuestoMensual;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OcSchema = SchemaFactory.createForClass(Oc);
