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
    await this.assertMesEnRangoDeOc(dto);

    const created = await this.recepcionModel.create({
      oc: dto.ocId,
      mes: dto.mes,
      horasRecepcionadas: dto.horasRecepcionadas,
      documento103: dto.documento103,
    });

    return created.populate(POPULATE);
  }

  async update(
    id: string,
    dto: CreateRecepcionDto,
  ): Promise<RecepcionDocument> {
    this.assertValidId(id);
    await this.assertMesEnRangoDeOc(dto);

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

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.recepcionModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  private async assertMesEnRangoDeOc(dto: CreateRecepcionDto): Promise<void> {
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
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
