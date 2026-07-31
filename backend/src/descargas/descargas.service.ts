import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Oc, OcDocument } from '../master-data/ocs/schemas/oc.schema';
import { PepDocument } from '../master-data/peps/schemas/pep.schema';
import { PerfilSapDocument } from '../master-data/perfiles-sap/schemas/perfil-sap.schema';
import { ConsultorDocument } from '../master-data/consultores/schemas/consultor.schema';
import {
  buildSolicitudLiberacionWorkbook,
  SolicitudLiberacionRow,
} from './solicitud-liberacion.workbook';

/**
 * Shape real de un `OcDocument` una vez poblado con `pep` y
 * `consultor.perfilSap` — Mongoose sigue tipando esos paths como
 * `Types.ObjectId` a nivel de esquema, así que se castea el resultado del
 * populate a esto en vez de forzar el tipo genérico de `.populate()`
 * (mismo problema práctico que ya evita el resto del dominio de OC leyendo
 * datos "en vivo" en vez de confiar en el tipo estático del documento).
 */
interface OcPoblada {
  solped: string;
  posicion: number;
  cantidadHoras: number;
  mesDesde: string;
  mesHasta: string;
  pep: PepDocument | null;
  consultor:
    (ConsultorDocument & { perfilSap: PerfilSapDocument | null }) | null;
}

@Injectable()
export class DescargasService {
  constructor(
    @InjectModel(Oc.name) private readonly ocModel: Model<OcDocument>,
  ) {}

  /** `null` si no hay ninguna posición exportable — el controller responde 204 sin armar el workbook. */
  async generarSolicitudLiberacion(): Promise<Buffer | null> {
    const ocs = (await this.ocModel
      .find({ completada: false, numeroOc: { $in: [null, ''] } })
      .populate('pep')
      .populate({ path: 'consultor', populate: { path: 'perfilSap' } })
      .sort({ solped: 1, posicion: 1 })
      .exec()) as unknown as OcPoblada[];

    const rows = this.mapearFilas(ocs);

    if (rows.length === 0) {
      return null;
    }

    return buildSolicitudLiberacionWorkbook(rows);
  }

  /**
   * Descarta posiciones cuyo PEP o Consultor referenciado ya no existe (sin
   * integridad referencial entre Oc y Consultor/Pep, ver
   * `OcsService`/CLAUDE.md): no hay un valor razonable para Imputación/País
   * en un documento formal de liberación, así que quedan afuera en vez de
   * mostrar un placeholder.
   */
  private mapearFilas(ocs: OcPoblada[]): SolicitudLiberacionRow[] {
    return ocs
      .filter((oc) => oc.pep && oc.consultor)
      .map((oc) => {
        const pep = oc.pep as PepDocument;
        const consultor = oc.consultor as ConsultorDocument & {
          perfilSap: PerfilSapDocument | null;
        };

        return {
          recurso: `${consultor.nombre} - ${consultor.proveedor}`,
          mesDesde: oc.mesDesde,
          mesHasta: oc.mesHasta,
          horas: oc.cantidadHoras,
          tarifaHora: consultor.perfilSap?.tarifaHora ?? 0,
          imputacion: pep.pepId,
          solped: oc.solped,
          pais: pep.pais,
        };
      });
  }
}
