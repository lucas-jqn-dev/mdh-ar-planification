import { Model, Types } from 'mongoose';
import { ConsultorDocument } from './schemas/consultor.schema';
import type { PerfilSapDocument } from '../perfiles-sap/schemas/perfil-sap.schema';

/**
 * Tarifa hora del Consultor indicado, leída en vivo desde su Perfil SAP
 * poblado (mismo criterio "sin snapshot" que el resto del dominio de OC).
 * 0 si el Consultor no tiene `perfilSap` asociado (dato legacy) — igual
 * criterio que `totalPosicion()` en el frontend. Compartida entre
 * `OcsService` (presupuesto mensual de la OC) y `RecepcionesService` (monto
 * real recepcionado contra `SaldoPep.realMensual`) para no duplicar el
 * populate + fallback.
 */
export async function getTarifaHora(
  consultorModel: Model<ConsultorDocument>,
  consultorId: string | Types.ObjectId,
): Promise<number> {
  const consultor = await consultorModel
    .findById(consultorId)
    .populate<{ perfilSap: PerfilSapDocument | null }>('perfilSap')
    .exec();

  return consultor?.perfilSap?.tarifaHora ?? 0;
}
