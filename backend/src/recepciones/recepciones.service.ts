import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions, Types } from 'mongoose';
import { CreateRecepcionDto } from './dto/create-recepcion.dto';
import { Recepcion, RecepcionDocument } from './schemas/recepcion.schema';
import { Oc, OcDocument } from '../master-data/ocs/schemas/oc.schema';
import { estaMesEnRango } from '../master-data/ocs/oc-presupuesto-mensual.util';

const NOT_FOUND_MESSAGE = 'Recepción no encontrada';
const OC_NOT_FOUND_MESSAGE = 'OC no encontrada';
const MES_FUERA_DE_RANGO_MESSAGE =
  'El mes debe estar dentro de la validez de la OC seleccionada';
const HORAS_EXCEDEN_DISPONIBLE_MESSAGE =
  'Las horas a recepcionar superan las horas disponibles de la OC';

/** Misma cadena de doble-populate que usa OcsService, un nivel más adentro (bajo `oc`). */
const POPULATE: PopulateOptions[] = [
  {
    path: 'oc',
    populate: [
      { path: 'pep' },
      { path: 'consultor', populate: { path: 'perfilSap' } },
    ],
  },
];

@Injectable()
export class RecepcionesService {
  constructor(
    @InjectModel(Recepcion.name)
    private readonly recepcionModel: Model<RecepcionDocument>,
    @InjectModel(Oc.name)
    private readonly ocModel: Model<OcDocument>,
  ) {}

  findAll(): Promise<RecepcionDocument[]> {
    return this.recepcionModel
      .find()
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(dto: CreateRecepcionDto): Promise<RecepcionDocument> {
    await this.assertOcYHorasValidas(dto, null);

    const created = await this.recepcionModel.create({
      oc: dto.ocId,
      mes: dto.mes,
      horasRecepcionadas: dto.horasRecepcionadas,
      documento103: dto.documento103,
    });

    await this.ocModel
      .updateOne(
        { _id: dto.ocId },
        { $inc: { horasConsumidas: dto.horasRecepcionadas } },
      )
      .exec();

    return created.populate(POPULATE);
  }

  async update(
    id: string,
    dto: CreateRecepcionDto,
  ): Promise<RecepcionDocument> {
    this.assertValidId(id);

    const existing = await this.recepcionModel.findById(id).exec();

    if (!existing) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    await this.assertOcYHorasValidas(dto, existing);

    const updated = await this.recepcionModel
      .findByIdAndUpdate(
        id,
        {
          oc: dto.ocId,
          mes: dto.mes,
          horasRecepcionadas: dto.horasRecepcionadas,
          documento103: dto.documento103,
        },
        { new: true, runValidators: true },
      )
      .populate(POPULATE)
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    await this.ajustarHorasConsumidas(existing, dto);

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.recepcionModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    await this.ocModel
      .updateOne(
        { _id: deleted.oc },
        { $inc: { horasConsumidas: -deleted.horasRecepcionadas } },
      )
      .exec();
  }

  /**
   * Valida existencia de la OC, que `mes` esté dentro de su validez, y que
   * `horasRecepcionadas` no supere sus horas disponibles
   * (`cantidadHoras - horasConsumidas`). Al editar una recepción ya
   * existente sobre la **misma** OC, sus propias horas previas se suman de
   * vuelta a lo disponible — si no, editar sin cambiar el valor fallaría
   * porque esas horas ya están contadas en `horasConsumidas`.
   */
  private async assertOcYHorasValidas(
    dto: CreateRecepcionDto,
    existing: RecepcionDocument | null,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(dto.ocId)) {
      throw new NotFoundException(OC_NOT_FOUND_MESSAGE);
    }

    const oc = await this.ocModel.findById(dto.ocId).exec();

    if (!oc) {
      throw new NotFoundException(OC_NOT_FOUND_MESSAGE);
    }

    if (!estaMesEnRango(dto.mes, oc.mesDesde, oc.mesHasta)) {
      throw new BadRequestException(MES_FUERA_DE_RANGO_MESSAGE);
    }

    const esMismaOc = existing && existing.oc.toString() === dto.ocId;
    const horasPropiasPrevias = esMismaOc ? existing.horasRecepcionadas : 0;
    const horasDisponibles =
      oc.cantidadHoras - oc.horasConsumidas + horasPropiasPrevias;

    if (dto.horasRecepcionadas > horasDisponibles) {
      throw new BadRequestException(HORAS_EXCEDEN_DISPONIBLE_MESSAGE);
    }
  }

  /** Mantiene `Oc.horasConsumidas` sincronizado tras editar una Recepcion ya existente. */
  private async ajustarHorasConsumidas(
    existing: RecepcionDocument,
    dto: CreateRecepcionDto,
  ): Promise<void> {
    const ocCambio = existing.oc.toString() !== dto.ocId;

    if (ocCambio) {
      await this.ocModel
        .updateOne(
          { _id: existing.oc },
          { $inc: { horasConsumidas: -existing.horasRecepcionadas } },
        )
        .exec();
      await this.ocModel
        .updateOne(
          { _id: dto.ocId },
          { $inc: { horasConsumidas: dto.horasRecepcionadas } },
        )
        .exec();
      return;
    }

    const delta = dto.horasRecepcionadas - existing.horasRecepcionadas;

    if (delta !== 0) {
      await this.ocModel
        .updateOne({ _id: dto.ocId }, { $inc: { horasConsumidas: delta } })
        .exec();
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
