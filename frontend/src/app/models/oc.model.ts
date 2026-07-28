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
