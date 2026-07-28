import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateConsultorDto } from './dto/create-consultor.dto';
import { Consultor, ConsultorDocument } from './schemas/consultor.schema';

const NOT_FOUND_MESSAGE = 'Consultor no encontrado';

@Injectable()
export class ConsultoresService {
  constructor(
    @InjectModel(Consultor.name)
    private readonly consultorModel: Model<ConsultorDocument>,
  ) {}

  findAll(): Promise<ConsultorDocument[]> {
    return this.consultorModel.find().sort({ proveedor: 1, nombre: 1 }).exec();
  }

  create(dto: CreateConsultorDto): Promise<ConsultorDocument> {
    return this.consultorModel.create(dto);
  }

  async update(
    id: string,
    dto: CreateConsultorDto,
  ): Promise<ConsultorDocument> {
    this.assertValidId(id);

    const updated = await this.consultorModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
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

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
