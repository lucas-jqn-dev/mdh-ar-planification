export interface PresupuestoMensual {
  enero: number;
  febrero: number;
  marzo: number;
  abril: number;
  mayo: number;
  junio: number;
  julio: number;
  agosto: number;
  septiembre: number;
  octubre: number;
  noviembre: number;
  diciembre: number;
}

export interface MesOption {
  key: keyof PresupuestoMensual;
  label: string;
}

/** Orden calendario. Debe mantenerse en espejo con backend/src/master-data/peps/schemas/pep.schema.ts */
export const MESES: MesOption[] = [
  { key: 'enero', label: 'Enero' },
  { key: 'febrero', label: 'Febrero' },
  { key: 'marzo', label: 'Marzo' },
  { key: 'abril', label: 'Abril' },
  { key: 'mayo', label: 'Mayo' },
  { key: 'junio', label: 'Junio' },
  { key: 'julio', label: 'Julio' },
  { key: 'agosto', label: 'Agosto' },
  { key: 'septiembre', label: 'Septiembre' },
  { key: 'octubre', label: 'Octubre' },
  { key: 'noviembre', label: 'Noviembre' },
  { key: 'diciembre', label: 'Diciembre' },
];

export function sumPresupuestoMensual(presupuesto: PresupuestoMensual): number {
  return MESES.reduce((total, mes) => total + (presupuesto[mes.key] || 0), 0);
}

export function crearPresupuestoMensualVacio(): PresupuestoMensual {
  return {
    enero: 0,
    febrero: 0,
    marzo: 0,
    abril: 0,
    mayo: 0,
    junio: 0,
    julio: 0,
    agosto: 0,
    septiembre: 0,
    octubre: 0,
    noviembre: 0,
    diciembre: 0,
  };
}

export interface Pep {
  id: string;
  pepId: string;
  descripcion?: string;
  presupuestoMensual: PresupuestoMensual;
  presupuestoTotal: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PepPayload = Pick<Pep, 'pepId' | 'descripcion' | 'presupuestoMensual'>;
