import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOcDto } from './dto/create-oc.dto';
import { UpdateOcCompletadaDto } from './dto/update-oc-completada.dto';
import { calcularPresupuestoMensual } from './oc-presupuesto-mensual.util';
import { Oc, OcDocument } from './schemas/oc.schema';
import { Pep, PepDocument } from '../peps/schemas/pep.schema';
import {
  Consultor,
  ConsultorDocument,
} from '../consultores/schemas/consultor.schema';
import type { PerfilSapDocument } from '../perfiles-sap/schemas/perfil-sap.schema';
import {
  Recepcion,
  RecepcionDocument,
} from '../../recepciones/schemas/recepcion.schema';

const NOT_FOUND_MESSAGE = 'OC no encontrada';
const PEP_NOT_FOUND_MESSAGE = 'PEP no encontrado';
const CONSULTOR_NOT_FOUND_MESSAGE = 'Consultor no encontrado';

@Injectable()
export class OcsService {
  constructor(
    @InjectModel(Oc.name)
    private readonly ocModel: Model<OcDocument>,
    @InjectModel(Pep.name)
    private readonly pepModel: Model<PepDocument>,
    @InjectModel(Consultor.name)
    private readonly consultorModel: Model<ConsultorDocument>,
    @InjectModel(Recepcion.name)
    private readonly recepcionModel: Model<RecepcionDocument>,
  ) {}

  findAll(): Promise<OcDocument[]> {
    return this.ocModel
      .find()
      .populate('pep')
      .populate({ path: 'consultor', populate: { path: 'perfilSap' } })
      .sort({ solped: 1, posicion: 1 })
      .exec();
  }

  async create(dto: CreateOcDto): Promise<OcDocument> {
    await this.assertPepExists(dto.pepId);
    await this.assertConsultorExists(dto.consultorId);

    const presupuestoMensual = await this.calcularPresupuestoMensualDto(dto);

    const created = await this.ocModel.create({
      solped: dto.solped,
      posicion: dto.posicion,
      numeroOc: dto.numeroOc,
      pep: dto.pepId,
      cantidadHoras: dto.cantidadHoras,
      consultor: dto.consultorId,
      mesDesde: dto.mesDesde,
      mesHasta: dto.mesHasta,
      presupuestoMensual,
    });

    return created.populate([
      { path: 'pep' },
      { path: 'consultor', populate: { path: 'perfilSap' } },
    ]);
  }

  async update(id: string, dto: CreateOcDto): Promise<OcDocument> {
    this.assertValidId(id);
    await this.assertSinRecepciones(id, 'editar');
    await this.assertPepExists(dto.pepId);
    await this.assertConsultorExists(dto.consultorId);

    const presupuestoMensual = await this.calcularPresupuestoMensualDto(dto);

    const updated = await this.ocModel
      .findByIdAndUpdate(
        id,
        {
          solped: dto.solped,
          posicion: dto.posicion,
          numeroOc: dto.numeroOc,
          pep: dto.pepId,
          cantidadHoras: dto.cantidadHoras,
          consultor: dto.consultorId,
          mesDesde: dto.mesDesde,
          mesHasta: dto.mesHasta,
          presupuestoMensual,
        },
        { new: true, runValidators: true },
      )
      .populate('pep')
      .populate({ path: 'consultor', populate: { path: 'perfilSap' } })
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return updated;
  }

  async setCompletada(
    id: string,
    dto: UpdateOcCompletadaDto,
  ): Promise<OcDocument> {
    this.assertValidId(id);

    const updated = await this.ocModel
      .findByIdAndUpdate(
        id,
        { completada: dto.completada },
        { new: true, runValidators: true },
      )
      .populate('pep')
      .populate({ path: 'consultor', populate: { path: 'perfilSap' } })
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);
    await this.assertSinRecepciones(id, 'eliminar');

    const deleted = await this.ocModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  private async assertPepExists(pepId: string): Promise<void> {
    if (!Types.ObjectId.isValid(pepId)) {
      throw new NotFoundException(PEP_NOT_FOUND_MESSAGE);
    }

    const exists = await this.pepModel.exists({ _id: pepId });

    if (!exists) {
      throw new NotFoundException(PEP_NOT_FOUND_MESSAGE);
    }
  }

  private async assertConsultorExists(consultorId: string): Promise<void> {
    if (!Types.ObjectId.isValid(consultorId)) {
      throw new NotFoundException(CONSULTOR_NOT_FOUND_MESSAGE);
    }

    const exists = await this.consultorModel.exists({ _id: consultorId });

    if (!exists) {
      throw new NotFoundException(CONSULTOR_NOT_FOUND_MESSAGE);
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  /**
   * Una OC con al menos una Recepción asociada no se puede editar ni
   * eliminar: sus datos (Consultor, Perfil SAP, Tarifa, PEP) se leen en
   * vivo desde cada Recepción vía populate, así que borrarla o cambiarle
   * el Consultor/PEP dejaría esas recepciones históricas con datos
   * incorrectos o huérfanos. A diferencia de la falta de integridad
   * referencial ya documentada para Consultor/Pep (que sí se pueden borrar
   * aunque una OC los referencie), acá el bloqueo fue pedido explícitamente.
   */
  private async assertSinRecepciones(
    id: string,
    accion: 'editar' | 'eliminar',
  ): Promise<void> {
    const count = await this.recepcionModel.countDocuments({ oc: id });

    if (count > 0) {
      const sustantivo = count === 1 ? 'recepción' : 'recepciones';
      throw new ConflictException(
        `No se puede ${accion} la OC: tiene ${count} ${sustantivo} asociada${count === 1 ? '' : 's'}.`,
      );
    }
  }

  /**
   * Monto total de la posición (tarifaHora del Consultor × cantidadHoras)
   * repartido entre los meses de mesDesde/mesHasta del DTO. 0 en todos los
   * meses si el Consultor no tiene Perfil SAP asociado (dato legacy), igual
   * criterio que `totalPosicion()` en el frontend.
   */
  private async calcularPresupuestoMensualDto(dto: CreateOcDto) {
    const tarifaHora = await this.getTarifaHora(dto.consultorId);
    const montoTotal = tarifaHora * dto.cantidadHoras;

    return calcularPresupuestoMensual(dto.mesDesde, dto.mesHasta, montoTotal);
  }

  private async getTarifaHora(consultorId: string): Promise<number> {
    const consultor = await this.consultorModel
      .findById(consultorId)
      .populate<{ perfilSap: PerfilSapDocument | null }>('perfilSap')
      .exec();

    return consultor?.perfilSap?.tarifaHora ?? 0;
  }
}
