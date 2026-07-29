import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePepDto } from './dto/create-pep.dto';
import { Pep, PepDocument } from './schemas/pep.schema';
import { SaldoPep, SaldoPepDocument } from './schemas/saldo-pep.schema';
import { defaultValidezAnioActual } from './saldo-pep.util';

const NOT_FOUND_MESSAGE = 'PEP no encontrado';
const DUPLICATE_MESSAGE = 'Ya existe un PEP con ese ID';

@Injectable()
export class PepsService {
  constructor(
    @InjectModel(Pep.name) private readonly pepModel: Model<PepDocument>,
    @InjectModel(SaldoPep.name)
    private readonly saldoPepModel: Model<SaldoPepDocument>,
  ) {}

  findAll(): Promise<PepDocument[]> {
    return this.pepModel
      .find()
      .populate('saldoActual')
      .sort({ pepId: 1 })
      .exec();
  }

  async create(dto: CreatePepDto): Promise<PepDocument> {
    await this.assertPepIdAvailable(dto.pepId);

    const pep = await this.pepModel.create({
      pepId: dto.pepId,
      descripcion: dto.descripcion,
      pais: dto.pais,
    });

    await this.upsertSaldoForecast(pep._id, dto.forecastMensual);

    return pep.populate('saldoActual');
  }

  async update(id: string, dto: CreatePepDto): Promise<PepDocument> {
    this.assertValidId(id);
    await this.assertPepIdAvailable(dto.pepId, id);

    const updated = await this.pepModel
      .findByIdAndUpdate(
        id,
        { pepId: dto.pepId, descripcion: dto.descripcion, pais: dto.pais },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    await this.upsertSaldoForecast(updated._id, dto.forecastMensual);

    return updated.populate('saldoActual');
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.pepModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    await this.saldoPepModel.deleteMany({ pep: new Types.ObjectId(id) }).exec();
  }

  /**
   * `forecastMensual` vive en `saldos_peps`, no en `peps` — al crear un PEP
   * esto siempre crea su `SaldoPep`; al editar uno que todavía no tiene
   * saldo (PEP cargado antes de esta etapa), lo crea recién ahí en vez de
   * fallar. `validezDesde`/`validezHasta` solo se setean en el insert
   * (`$setOnInsert`): no se pisan en cada edición porque hoy ningún flujo
   * las cambia — solo se definen una vez, al crear el saldo.
   *
   * `pepId` se reconstruye con `new Types.ObjectId(pepId.toString())` antes
   * de usarlo en el filtro/`$setOnInsert` — ver el comentario largo en
   * `OcsService.incrementarAsignacionMensual()` sobre por qué un
   * `Types.ObjectId` leído de un documento Mongoose no siempre calza
   * `instanceof` contra la clase importada acá, y por qué eso hace que el
   * `upsert` cree un `SaldoPep` duplicado en vez de encontrar el existente.
   */
  private async upsertSaldoForecast(
    pepId: Types.ObjectId,
    forecastMensual: CreatePepDto['forecastMensual'],
  ): Promise<void> {
    const pepObjectId = new Types.ObjectId(pepId.toString());
    const { validezDesde, validezHasta } = defaultValidezAnioActual();

    await this.saldoPepModel
      .findOneAndUpdate(
        { pep: pepObjectId },
        {
          $set: { forecastMensual },
          $setOnInsert: { pep: pepObjectId, validezDesde, validezHasta },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async assertPepIdAvailable(
    pepId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.pepModel
      .findOne({ pepId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
      .lean();

    if (existing) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
