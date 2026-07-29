import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MES_ANIO_REGEX, Oc } from '../../master-data/ocs/schemas/oc.schema';
import { normalizePopulatedRef } from '../../master-data/shared/normalize-populated-ref.util';

export type RecepcionDocument = HydratedDocument<Recepcion>;

@Schema({
  timestamps: true,
  collection: 'recepciones',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;

      // Mismo patrón que oc.schema.ts, un nivel más profundo: `oc` viene
      // poblada con su propio `pep` y `consultor.perfilSap` poblados, y
      // Mongoose no aplica el toJSON de esos schemas referenciados
      // automáticamente sobre un path populado.
      const oc = ret.oc;
      normalizePopulatedRef(oc);
      if (oc && typeof oc === 'object') {
        const ocRecord = oc as Record<string, unknown>;
        normalizePopulatedRef(ocRecord.pep);

        const consultor = ocRecord.consultor;
        normalizePopulatedRef(consultor);
        if (consultor && typeof consultor === 'object') {
          normalizePopulatedRef(
            (consultor as Record<string, unknown>).perfilSap,
          );
        }
      }
    },
  },
})
export class Recepcion {
  /** Posición de OC recepcionada (ref a Oc). */
  @Prop({ type: Types.ObjectId, ref: Oc.name, required: true })
  oc: Types.ObjectId;

  /** Mes recepcionado, formato "YYYY-MM" — debe estar dentro de mesDesde/mesHasta de la OC referenciada. */
  @Prop({ required: true, match: MES_ANIO_REGEX })
  mes: string;

  @Prop({ type: Number, required: true, min: 0.01 })
  horasRecepcionadas: number;

  /** Comprobante de recepción del proceso SAP ("Documento 103"). */
  @Prop({ required: true, trim: true })
  documento103: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const RecepcionSchema = SchemaFactory.createForClass(Recepcion);
