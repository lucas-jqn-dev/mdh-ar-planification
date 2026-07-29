/**
 * "YYYY-01-01" / "YYYY-12-31" del año calendario en curso, para el default
 * de validez de un `SaldoPep` nuevo. Reusado tanto por `PepsService` (al
 * crear/editar un PEP) como por `OcsService` (al tener que upsertear un
 * `SaldoPep` inexistente mientras sincroniza `asignacionMensual`).
 */
export function defaultValidezAnioActual(): {
  validezDesde: string;
  validezHasta: string;
} {
  const anio = new Date().getFullYear();
  return { validezDesde: `${anio}-01-01`, validezHasta: `${anio}-12-31` };
}
