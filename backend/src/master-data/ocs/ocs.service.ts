import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOcDto } from './dto/create-oc.dto';
import { UpdateOcCompletadaDto } from './dto/update-oc-completada.dto';
import { Oc, OcDocument } from './schemas/oc.schema';
import { Pep, PepDocument } from '../peps/schemas/pep.schema';
import {
  Consultor,
  ConsultorDocument,
} from '../consultores/schemas/consultor.schema';

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

    const created = await this.ocModel.create({
      solped: dto.solped,
      posicion: dto.posicion,
      numeroOc: dto.numeroOc,
      pep: dto.pepId,
      cantidadHoras: dto.cantidadHoras,
      consultor: dto.consultorId,
      mesDesde: dto.mesDesde,
      mesHasta: dto.mesHasta,
    });

    return created.populate([
      { path: 'pep' },
      { path: 'consultor', populate: { path: 'perfilSap' } },
    ]);
  }

  async update(id: string, dto: CreateOcDto): Promise<OcDocument> {
    this.assertValidId(id);
    await this.assertPepExists(dto.pepId);
    await this.assertConsultorExists(dto.consultorId);

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
}
