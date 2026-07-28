import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateConsultorDto } from './dto/create-consultor.dto';
import { Consultor, ConsultorDocument } from './schemas/consultor.schema';
import {
  PerfilSap,
  PerfilSapDocument,
} from '../perfiles-sap/schemas/perfil-sap.schema';

const NOT_FOUND_MESSAGE = 'Consultor no encontrado';
const PERFIL_SAP_NOT_FOUND_MESSAGE = 'Perfil SAP no encontrado';

@Injectable()
export class ConsultoresService {
  constructor(
    @InjectModel(Consultor.name)
    private readonly consultorModel: Model<ConsultorDocument>,
    @InjectModel(PerfilSap.name)
    private readonly perfilSapModel: Model<PerfilSapDocument>,
  ) {}

  findAll(): Promise<ConsultorDocument[]> {
    return this.consultorModel
      .find()
      .populate('perfilSap')
      .sort({ proveedor: 1, nombre: 1 })
      .exec();
  }

  async create(dto: CreateConsultorDto): Promise<ConsultorDocument> {
    await this.assertPerfilSapExists(dto.perfilSapId);

    const created = await this.consultorModel.create({
      nombre: dto.nombre,
      proveedor: dto.proveedor,
      equipo: dto.equipo,
      responsable: dto.responsable,
      perfilSap: dto.perfilSapId,
    });

    return created.populate('perfilSap');
  }

  async update(
    id: string,
    dto: CreateConsultorDto,
  ): Promise<ConsultorDocument> {
    this.assertValidId(id);
    await this.assertPerfilSapExists(dto.perfilSapId);

    const updated = await this.consultorModel
      .findByIdAndUpdate(
        id,
        {
          nombre: dto.nombre,
          proveedor: dto.proveedor,
          equipo: dto.equipo,
          responsable: dto.responsable,
          perfilSap: dto.perfilSapId,
        },
        { new: true, runValidators: true },
      )
      .populate('perfilSap')
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.consultorModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  private async assertPerfilSapExists(perfilSapId: string): Promise<void> {
    if (!Types.ObjectId.isValid(perfilSapId)) {
      throw new NotFoundException(PERFIL_SAP_NOT_FOUND_MESSAGE);
    }

    const exists = await this.perfilSapModel.exists({ _id: perfilSapId });

    if (!exists) {
      throw new NotFoundException(PERFIL_SAP_NOT_FOUND_MESSAGE);
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
