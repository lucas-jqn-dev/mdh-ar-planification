import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePepDto } from './dto/create-pep.dto';
import { Pep, PepDocument } from './schemas/pep.schema';

const NOT_FOUND_MESSAGE = 'PEP no encontrado';
const DUPLICATE_MESSAGE = 'Ya existe un PEP con ese ID';

@Injectable()
export class PepsService {
  constructor(
    @InjectModel(Pep.name) private readonly pepModel: Model<PepDocument>,
  ) {}

  findAll(): Promise<PepDocument[]> {
    return this.pepModel.find().sort({ pepId: 1 }).exec();
  }

  async create(dto: CreatePepDto): Promise<PepDocument> {
    await this.assertPepIdAvailable(dto.pepId);
    return this.pepModel.create(dto);
  }

  async update(id: string, dto: CreatePepDto): Promise<PepDocument> {
    this.assertValidId(id);
    await this.assertPepIdAvailable(dto.pepId, id);

    const updated = await this.pepModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);

    const deleted = await this.pepModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
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
