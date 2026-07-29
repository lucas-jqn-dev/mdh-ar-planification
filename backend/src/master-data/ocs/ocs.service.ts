import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOcDto } from './dto/create-oc.dto';
import { UpdateOcCompletadaDto } from './dto/update-oc-completada.dto';
import {
  calcularPresupuestoMensual,
  deltaPresupuestoMensual,
  presupuestoConSigno,
} from './oc-presupuesto-mensual.util';
import { Oc, OcDocument } from './schemas/oc.schema';
import { Mes, Pep, PepDocument } from '../peps/schemas/pep.schema';
import { SaldoPep, SaldoPepDocument } from '../peps/schemas/saldo-pep.schema';
import { defaultValidezAnioActual } from '../peps/saldo-pep.util';
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
    @InjectModel(SaldoPep.name)
    private readonly saldoPepModel: Model<SaldoPepDocument>,
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

    await this.incrementarAsignacionMensual(
      new Types.ObjectId(dto.pepId),
      presupuestoConSigno(presupuestoMensual, 1),
    );

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

    const existing = await this.ocModel.findById(id).exec();

    if (!existing) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

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

    await this.reasignarAsignacionMensual(
      existing,
      dto.pepId,
      presupuestoMensual,
    );

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

    await this.incrementarAsignacionMensual(
      deleted.pep,
      presupuestoConSigno(deleted.presupuestoMensual, -1),
    );
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

  /**
   * Mantiene `SaldoPep.asignacionMensual` sincronizado tras editar una OC
   * ya existente. Si el PEP no cambió, aplica el delta neto (`nuevo -
   * viejo`) en un solo `$inc`; si cambió, resta el presupuesto viejo del
   * PEP anterior y suma el nuevo al PEP nuevo (dos `$inc` separados) — mismo
   * criterio que usa `RecepcionesService.ajustarHorasConsumidas()` para el
   * caso análogo de `Oc.horasConsumidas`.
   */
  private async reasignarAsignacionMensual(
    existing: OcDocument,
    nuevoPepId: string,
    nuevoPresupuesto: OcDocument['presupuestoMensual'],
  ): Promise<void> {
    const pepCambio = existing.pep.toString() !== nuevoPepId;

    if (pepCambio) {
      await this.incrementarAsignacionMensual(
        existing.pep,
        presupuestoConSigno(existing.presupuestoMensual, -1),
      );
      await this.incrementarAsignacionMensual(
        new Types.ObjectId(nuevoPepId),
        presupuestoConSigno(nuevoPresupuesto, 1),
      );
      return;
    }

    await this.incrementarAsignacionMensual(
      existing.pep,
      deltaPresupuestoMensual(nuevoPresupuesto, existing.presupuestoMensual),
    );
  }

  /**
   * Aplica un `$inc` atómico por mes contra `SaldoPep.asignacionMensual`
   * del PEP indicado. Si ese PEP todavía no tiene `SaldoPep` (legacy, nunca
   * editado desde que se creó `saldos_peps`), lo upsertea con la validez
   * default del año en curso — mismo patrón que
   * `PepsService.upsertSaldoForecast()`.
   *
   * `pepId` se reconstruye siempre con `new Types.ObjectId(pepId.toString())`
   * antes de usarlo — un `Types.ObjectId` leído de un documento Mongoose
   * (`existing.pep`/`deleted.pep`) no siempre pasa `instanceof
   * Types.ObjectId` contra la clase importada acá (dual package hazard de
   * `mongoose`/`bson` dentro de este monorepo con npm workspaces), y en ese
   * caso Mongoose lo escribe tal cual en `$setOnInsert` — como un valor que
   * NO calza con el `pep: ObjectId(...)` ya guardado en el `SaldoPep`
   * original, el `upsert` no lo encuentra y crea un `SaldoPep` **duplicado**
   * con `pep` como string. Reconstruir explícitamente el ObjectId a partir
   * del string evita esto sin depender de que el objeto de entrada ya sea
   * "suficientemente ObjectId".
   */
  private async incrementarAsignacionMensual(
    pepId: Types.ObjectId,
    deltasPorMes: Record<Mes, number>,
  ): Promise<void> {
    const incFields: Record<string, number> = {};
    for (const [mes, monto] of Object.entries(deltasPorMes)) {
      if (monto) {
        incFields[`asignacionMensual.${mes}`] = monto;
      }
    }

    if (Object.keys(incFields).length === 0) {
      return;
    }

    const pepObjectId = new Types.ObjectId(pepId.toString());
    const { validezDesde, validezHasta } = defaultValidezAnioActual();

    await this.saldoPepModel
      .findOneAndUpdate(
        { pep: pepObjectId },
        {
          $inc: incFields,
          $setOnInsert: { pep: pepObjectId, validezDesde, validezHasta },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
