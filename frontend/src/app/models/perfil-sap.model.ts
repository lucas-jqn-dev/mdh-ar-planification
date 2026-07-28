import { Proveedor } from './consultor.model';

export interface PerfilSap {
  id: string;
  codigoSap: string;
  descripcion: string;
  tarifaHora: number;
  proveedor: Proveedor;
  createdAt?: string;
  updatedAt?: string;
}

export type PerfilSapPayload = Pick<
  PerfilSap,
  'codigoSap' | 'descripcion' | 'tarifaHora' | 'proveedor'
>;
