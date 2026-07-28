import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({
        $or: [{ username: dto.username }, { email: dto.email.toLowerCase() }],
      })
      .lean();

    if (existing) {
      throw new ConflictException('El usuario o email ya existe');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.userModel.create({
      username: dto.username,
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });
  }

  async findByUsernameOrEmail(
    identifier: string,
  ): Promise<UserDocument | null> {
    const normalized = identifier.trim();
    return this.userModel
      .findOne({
        $or: [{ username: normalized }, { email: normalized.toLowerCase() }],
      })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }

  async findByIdWithRefreshHash(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async incrementFailedAttempts(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $inc: { failedLoginAttempts: 1 } },
        { new: true },
      )
      .exec();
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { failedLoginAttempts: 0, lockUntil: null })
      .exec();
  }

  async setLockUntil(id: string, lockUntil: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lockUntil }).exec();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { lastLogin: new Date() })
      .exec();
  }

  async setRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { refreshTokenHash }).exec();
  }
}
