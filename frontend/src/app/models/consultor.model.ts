import { PerfilSap } from './perfil-sap.model';

/**
 * Valores iniciales tomados de la solapa "1- Consultores" del planificador
 * Excel. Son ajustables: agregar/quitar miembros del enum a medida que
 * cambien los proveedores, equipos o responsables reales. Debe mantenerse
 * en espejo con backend/src/master-data/consultores/schemas/consultor.schema.ts
 */
export enum Proveedor {
  ADVANCED = 'ADVANCED',
  BRIGHTSIDE = 'BRIGHTSIDE',
  FRICE = 'FRICE',
  MAGNO = 'MAGNO',
  NEORIS = 'NEORIS',
  RRHH_Y_SOL_TEC = 'RRHH Y SOL. TEC',
}

export enum Equipo {
  COMERCIAL = 'Comercial',
  I_MAS_D = 'I+D',
  PROY = 'Proyectos',
  SUPPLY = 'Supply',
}

export enum Responsable {
  ARIEL = 'Ariel',
  LUCAS = 'Lucas',
  NATALIA = 'Natalia',
  SANTIAGO = 'Santiago',
}

export interface Consultor {
  id: string;
  nombre: string;
  proveedor: Proveedor;
  equipo: Equipo;
  responsable: Responsable;
  /** null en registros creados antes de agregar este campo (no migrados). */
  perfilSap: PerfilSap | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ConsultorPayload = Pick<Consultor, 'nombre' | 'proveedor' | 'equipo' | 'responsable'> & {
  perfilSapId: string;
};
