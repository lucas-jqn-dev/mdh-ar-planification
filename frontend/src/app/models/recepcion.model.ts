import { Oc } from './oc.model';

export interface Recepcion {
  id: string;
  /** null si la OC referenciada fue eliminada luego de crear la recepción (sin integridad referencial, igual que Oc.pep/Oc.consultor). */
  oc: Oc | null;
  /** Mes recepcionado, formato "YYYY-MM". */
  mes: string;
  horasRecepcionadas: number;
  documento103: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecepcionPayload {
  ocId: string;
  mes: string;
  horasRecepcionadas: number;
  documento103: string;
}
