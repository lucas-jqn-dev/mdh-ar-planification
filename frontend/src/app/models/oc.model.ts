import { Consultor } from './consultor.model';
import { MESES, Pep } from './pep.model';

export interface Oc {
  id: string;
  solped: string;
  posicion: number;
  numeroOc?: string;
  /** null si el Pep referenciado fue eliminado luego de crear la OC. */
  pep: Pep | null;
  cantidadHoras: number;
  /** null si el Consultor referenciado fue eliminado luego de crear la OC. */
  consultor: Consultor | null;
  /** Mes de inicio/fin de validez de la OC, formato "YYYY-MM". */
  mesDesde: string;
  mesHasta: string;
  /** Estado de la posición: false = Pendiente (default al crear), true = Completada. */
  completada: boolean;
  /** Acumulador de horas recepcionadas contra esta posición (arranca en 0, lo mantiene sincronizado RecepcionesService en el backend). */
  horasConsumidas: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OcPayload {
  solped: string;
  posicion: number;
  numeroOc?: string;
  pepId: string;
  cantidadHoras: number;
  consultorId: string;
  mesDesde: string;
  mesHasta: string;
}

/** "2025-07" -> "Julio 2025". Debe mantenerse en espejo con el formato MES_ANIO_REGEX del backend. */
export function formatMesAnio(mesAnio: string): string {
  const [anio, mes] = mesAnio.split('-');
  const mesOption = MESES[Number(mes) - 1];
  return mesOption ? `${mesOption.label} ${anio}` : mesAnio;
}

/** "2025-07" -> Date(2025, 6, 1), para inicializar un datepicker restringido a mes. */
export function parseMesAnio(mesAnio: string): Date {
  const [anio, mes] = mesAnio.split('-').map(Number);
  return new Date(anio, mes - 1, 1);
}

/** Date -> "2025-07", para enviar al backend. */
export function formatDateAsMesAnio(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Enumera "YYYY-MM" entre mesDesde y mesHasta (ambos inclusive) — ej. para
 * poblar el desplegable de "mes a recepcionar" del dialog de Recepciones.
 * Espejo de `mesesEnRango`/`toMesAbsoluto` en
 * `backend/src/master-data/ocs/oc-presupuesto-mensual.util.ts`.
 */
export function enumerarMeses(mesDesde: string, mesHasta: string): string[] {
  const [anioDesde, mesNumDesde] = mesDesde.split('-').map(Number);
  const [anioHasta, mesNumHasta] = mesHasta.split('-').map(Number);
  const desde = anioDesde * 12 + (mesNumDesde - 1);
  const hasta = anioHasta * 12 + (mesNumHasta - 1);

  const meses: string[] = [];
  for (let mesAbsoluto = desde; mesAbsoluto <= hasta; mesAbsoluto++) {
    const anio = Math.floor(mesAbsoluto / 12);
    const mes = (mesAbsoluto % 12) + 1;
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
  }
  return meses;
}
