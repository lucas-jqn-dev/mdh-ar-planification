import { Mes, MESES, PresupuestoMensual } from '../peps/schemas/pep.schema';

/**
 * Reparte `montoTotal` en partes iguales entre los meses del rango
 * [mesDesde, mesHasta] (ambos "YYYY-MM", ambos inclusive), devolviendo un
 * `PresupuestoMensual` con el resto de los meses en 0.
 *
 * Sin dimensión de año (mismo shape que `Pep.presupuestoMensual`): un rango
 * que cruza fin de año (ej. "2026-11" a "2027-02") no distingue el año, solo
 * repite el nombre del mes — un rango de más de 12 meses volvería a sumar
 * sobre el mismo mes más de una vez. Limitación consciente, no un bug.
 */
export function calcularPresupuestoMensual(
  mesDesde: string,
  mesHasta: string,
  montoTotal: number,
): PresupuestoMensual {
  const base = MESES.reduce(
    (acc, mes) => ({ ...acc, [mes]: 0 }),
    {} as PresupuestoMensual,
  );

  const meses = mesesEnRango(mesDesde, mesHasta);

  if (meses.length === 0) {
    return base;
  }

  const montoPorMes = montoTotal / meses.length;

  for (const mes of meses) {
    base[mes] += montoPorMes;
  }

  return base;
}

/**
 * `presupuesto` con cada mes multiplicado por `signo` — usado por
 * `OcsService` para sumar (+1, al crear la OC o al asignarla a un PEP
 * nuevo tras cambiar de PEP) o restar (-1, al eliminar la OC o al
 * quitarla del PEP viejo tras cambiar de PEP) contra
 * `SaldoPep.asignacionMensual`.
 */
export function presupuestoConSigno(
  presupuesto: PresupuestoMensual,
  signo: 1 | -1,
): Record<Mes, number> {
  const resultado = {} as Record<Mes, number>;
  for (const mes of MESES) {
    resultado[mes] = signo * (presupuesto[mes] ?? 0);
  }
  return resultado;
}

/**
 * Delta neto por mes (`nuevo - viejo`) — usado por `OcsService` al editar
 * una OC que sigue asignada al **mismo** PEP, para ajustar
 * `SaldoPep.asignacionMensual` sin tener que restar todo y volver a sumar.
 */
export function deltaPresupuestoMensual(
  nuevo: PresupuestoMensual,
  viejo: PresupuestoMensual,
): Record<Mes, number> {
  const resultado = {} as Record<Mes, number>;
  for (const mes of MESES) {
    resultado[mes] = (nuevo[mes] ?? 0) - (viejo[mes] ?? 0);
  }
  return resultado;
}

/**
 * "YYYY-MM" -> nombre de mes en español (`Mes`) — usado por
 * `RecepcionesService` para indexar `SaldoPep.realMensual` por el mes
 * puntual de una Recepción (a diferencia de `mesesEnRango`, que expande un
 * rango completo). Asume formato válido — se llama siempre después de
 * `estaMesEnRango()`, que ya lo valida.
 */
export function mesNombre(mesAnio: string): Mes {
  const mes = Number(mesAnio.slice(5, 7));
  return MESES[mes - 1];
}

/** Usado por RecepcionesService para validar que el mes de una Recepción esté dentro de la validez de la OC. */
export function estaMesEnRango(
  mes: string,
  mesDesde: string,
  mesHasta: string,
): boolean {
  const mesAbsoluto = toMesAbsoluto(mes);
  const desde = toMesAbsoluto(mesDesde);
  const hasta = toMesAbsoluto(mesHasta);

  if (mesAbsoluto === null || desde === null || hasta === null) {
    return false;
  }

  return mesAbsoluto >= desde && mesAbsoluto <= hasta;
}

function mesesEnRango(mesDesde: string, mesHasta: string): Mes[] {
  const desde = toMesAbsoluto(mesDesde);
  const hasta = toMesAbsoluto(mesHasta);

  if (desde === null || hasta === null || hasta < desde) {
    return [];
  }

  const meses: Mes[] = [];

  for (let mesAbsoluto = desde; mesAbsoluto <= hasta; mesAbsoluto++) {
    meses.push(MESES[((mesAbsoluto % 12) + 12) % 12]);
  }

  return meses;
}

/** "YYYY-MM" -> cantidad total de meses desde el año 0, para poder iterar un rango. */
function toMesAbsoluto(mesAnio: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mesAnio);

  if (!match) {
    return null;
  }

  const anio = Number(match[1]);
  const mes = Number(match[2]);

  return anio * 12 + (mes - 1);
}
