import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePerfilSapDto } from './dto/create-perfil-sap.dto';
import { PerfilSap, PerfilSapDocument } from './schemas/perfil-sap.schema';

const NOT_FOUND_MESSAGE = 'Perfil SAP no encontrado';
const DUPLICATE_MESSAGE = 'Ya existe un perfil SAP con ese código';

@Injectable()
export class PerfilesSapService {
  constructor(
    @InjectModel(PerfilSap.name)
    private readonly perfilSapModel: Model<PerfilSapDocument>,
  ) {}

  findAll(): Promise<PerfilSapDocument[]> {
    return this.perfilSapModel.find().sort({ codigoSap: 1 }).exec();
  }

  async create(dto: CreatePerfilSapDto): Promise<PerfilSapDocument> {
    await this.assertCodigoSapAvailable(dto.codigoSap);
    return this.perfilSapModel.create(dto);
  }

  async update(
    id: string,
    dto: CreatePerfilSapDto,
  ): Promise<PerfilSapDocument> {
    this.assertValidId(id);
    await this.assertCodigoSapAvailable(dto.codigoSap, id);

    const updated = await this.perfilSapModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.perfilSapModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  private async assertCodigoSapAvailable(
    codigoSap: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.perfilSapModel
      .findOne({
        codigoSap,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
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
