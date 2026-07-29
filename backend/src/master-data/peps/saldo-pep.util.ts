import { Model, Types } from 'mongoose';
import { Mes } from './schemas/pep.schema';
import { SaldoPepDocument } from './schemas/saldo-pep.schema';

/**
 * "YYYY-01-01" / "YYYY-12-31" del año calendario en curso, para el default
 * de validez de un `SaldoPep` nuevo. Reusado tanto por `PepsService` (al
 * crear/editar un PEP) como por `incrementarSaldoPepCampo()` (al tener que
 * upsertear un `SaldoPep` inexistente mientras sincroniza
 * `asignacionMensual`/`realMensual`).
 */
export function defaultValidezAnioActual(): {
  validezDesde: string;
  validezHasta: string;
} {
  const anio = new Date().getFullYear();
  return { validezDesde: `${anio}-01-01`, validezHasta: `${anio}-12-31` };
}

/**
 * Aplica un `$inc` atómico por mes contra el campo indicado
 * (`asignacionMensual`/`realMensual`) del `SaldoPep` del PEP dado. Si ese
 * PEP todavía no tiene `SaldoPep` (legacy, nunca editado desde que se creó
 * `saldos_peps`), lo upsertea con la validez default del año en curso.
 * Compartido entre `OcsService` (`asignacionMensual`, al crear/editar/borrar
 * una OC) y `RecepcionesService` (`realMensual`, al crear/editar/borrar una
 * Recepción) para no duplicar el upsert ni el gotcha de reconstruir el
 * ObjectId, documentado abajo.
 *
 * `pepId` se reconstruye siempre con `new Types.ObjectId(pepId.toString())`
 * antes de usarlo — un `Types.ObjectId` leído de un documento Mongoose
 * (`existing.pep`/`deleted.pep`/`oc.pep`) no siempre pasa `instanceof
 * Types.ObjectId` contra la clase importada acá (dual package hazard de
 * `mongoose`/`bson` dentro de este monorepo con npm workspaces), y en ese
 * caso Mongoose lo escribe tal cual en `$setOnInsert` — como un valor que NO
 * calza con el `pep: ObjectId(...)` ya guardado en el `SaldoPep` original,
 * el `upsert` no lo encuentra y crea un `SaldoPep` **duplicado** con `pep`
 * como string. Reconstruir explícitamente el ObjectId a partir del string
 * evita esto sin depender de que el objeto de entrada ya sea
 * "suficientemente ObjectId".
 */
export async function incrementarSaldoPepCampo(
  saldoPepModel: Model<SaldoPepDocument>,
  pepId: Types.ObjectId,
  campo: 'asignacionMensual' | 'realMensual',
  deltasPorMes: Partial<Record<Mes, number>>,
): Promise<void> {
  const incFields: Record<string, number> = {};
  for (const [mes, monto] of Object.entries(deltasPorMes)) {
    if (monto) {
      incFields[`${campo}.${mes}`] = monto;
    }
  }

  if (Object.keys(incFields).length === 0) {
    return;
  }

  const pepObjectId = new Types.ObjectId(pepId.toString());
  const { validezDesde, validezHasta } = defaultValidezAnioActual();

  await saldoPepModel
    .findOneAndUpdate(
      { pep: pepObjectId },
      {
        $inc: incFields,
        $setOnInsert: { pep: pepObjectId, validezDesde, validezHasta },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
    .exec();
}
