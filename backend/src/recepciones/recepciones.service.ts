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
import {
  estaMesEnRango,
  mesNombre,
} from '../master-data/ocs/oc-presupuesto-mensual.util';
import {
  Consultor,
  ConsultorDocument,
} from '../master-data/consultores/schemas/consultor.schema';
import { getTarifaHora } from '../master-data/consultores/consultor-tarifa.util';
import {
  SaldoPep,
  SaldoPepDocument,
} from '../master-data/peps/schemas/saldo-pep.schema';
import { incrementarSaldoPepCampo } from '../master-data/peps/saldo-pep.util';

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
    @InjectModel(Consultor.name)
    private readonly consultorModel: Model<ConsultorDocument>,
    @InjectModel(SaldoPep.name)
    private readonly saldoPepModel: Model<SaldoPepDocument>,
  ) {}

  findAll(): Promise<RecepcionDocument[]> {
    return this.recepcionModel
      .find()
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(dto: CreateRecepcionDto): Promise<RecepcionDocument> {
    const oc = await this.assertOcYHorasValidas(dto, null);

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

    const tarifaHora = await getTarifaHora(
      this.consultorModel,
      oc.consultor.toString(),
    );
    await this.ajustarRealMensual(
      oc.pep,
      dto.mes,
      tarifaHora * dto.horasRecepcionadas,
      1,
    );

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

    const ocNueva = await this.assertOcYHorasValidas(dto, existing);

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
    await this.ajustarRealMensualEnEdicion(existing, dto, ocNueva);

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

    const oc = await this.ocModel.findById(deleted.oc).exec();

    if (oc) {
      const tarifaHora = await getTarifaHora(
        this.consultorModel,
        oc.consultor.toString(),
      );
      await this.ajustarRealMensual(
        oc.pep,
        deleted.mes,
        tarifaHora * deleted.horasRecepcionadas,
        -1,
      );
    }
  }

  /**
   * Valida existencia de la OC, que `mes` esté dentro de su validez, y que
   * `horasRecepcionadas` no supere sus horas disponibles
   * (`cantidadHoras - horasConsumidas`). Al editar una recepción ya
   * existente sobre la **misma** OC, sus propias horas previas se suman de
   * vuelta a lo disponible — si no, editar sin cambiar el valor fallaría
   * porque esas horas ya están contadas en `horasConsumidas`. Devuelve el
   * documento de la OC para que los callers no tengan que volver a
   * buscarla (necesitan `pep`/`consultor` para sincronizar
   * `SaldoPep.realMensual`).
   */
  private async assertOcYHorasValidas(
    dto: CreateRecepcionDto,
    existing: RecepcionDocument | null,
  ): Promise<OcDocument> {
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

    return oc;
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

  /**
   * Revierte el monto que la Recepción vieja aportaba a
   * `SaldoPep.realMensual` (PEP/mes/tarifa de la OC **anterior**) y aplica
   * el monto nuevo (PEP/mes/tarifa de la OC **actual**) — mismo criterio de
   * "revertir viejo + aplicar nuevo" que `ajustarHorasConsumidas`, pero acá
   * hace falta resolver tarifa y PEP por separado para cada lado porque
   * pueden pertenecer a OCs (y por lo tanto PEPs/tarifas) distintas. Si la
   * OC no cambió, `ocVieja`/`ocNueva` son el mismo documento y no hace
   * falta una segunda consulta.
   */
  private async ajustarRealMensualEnEdicion(
    existing: RecepcionDocument,
    dto: CreateRecepcionDto,
    ocNueva: OcDocument,
  ): Promise<void> {
    const ocVieja =
      existing.oc.toString() === dto.ocId
        ? ocNueva
        : await this.ocModel.findById(existing.oc).exec();

    if (ocVieja) {
      const tarifaVieja = await getTarifaHora(
        this.consultorModel,
        ocVieja.consultor.toString(),
      );
      await this.ajustarRealMensual(
        ocVieja.pep,
        existing.mes,
        tarifaVieja * existing.horasRecepcionadas,
        -1,
      );
    }

    const tarifaNueva = await getTarifaHora(
      this.consultorModel,
      ocNueva.consultor.toString(),
    );
    await this.ajustarRealMensual(
      ocNueva.pep,
      dto.mes,
      tarifaNueva * dto.horasRecepcionadas,
      1,
    );
  }

  /**
   * Aplica (o revierte, con `signo: -1`) el monto de una Recepción
   * (`tarifaHora × horasRecepcionadas`) contra `SaldoPep.realMensual` del
   * mes correspondiente — mismo criterio que `OcsService` usa para
   * `asignacionMensual`, pero para un único mes en vez de un rango completo
   * (una Recepción imputa un solo mes, no una OC entera).
   */
  private async ajustarRealMensual(
    pepId: Types.ObjectId,
    mes: string,
    monto: number,
    signo: 1 | -1,
  ): Promise<void> {
    await incrementarSaldoPepCampo(this.saldoPepModel, pepId, 'realMensual', {
      [mesNombre(mes)]: signo * monto,
    });
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
