import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from './strategies/jwt.strategy';

const REFRESH_HASH_ROUNDS = 12;
const GENERIC_INVALID_CREDENTIALS_MESSAGE = 'Usuario o contraseña incorrectos';

export interface AuthContext {
  ip: string;
  userAgent: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface SanitizedUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async login(
    identifier: string,
    password: string,
    context: AuthContext,
  ): Promise<{ tokens: TokenPair; user: SanitizedUser }> {
    const user = await this.usersService.findByUsernameOrEmail(identifier);

    if (!user) {
      this.logger.warn({
        event: 'login_failed',
        reason: 'not_found',
        identifier,
        ...context,
      });
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      this.logger.warn({
        event: 'login_blocked',
        reason: 'locked',
        userId: user.id,
        ...context,
      });
      throw new UnauthorizedException(
        'Cuenta bloqueada temporalmente por intentos fallidos. Intenta nuevamente mas tarde.',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches || !user.active) {
      await this.registerFailedAttempt(user);
      this.logger.warn({
        event: 'login_failed',
        reason: 'bad_credentials',
        userId: user.id,
        ...context,
      });
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    await this.usersService.resetFailedAttempts(user.id);
    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.issueTokenPair(user);
    this.logger.log({ event: 'login_success', userId: user.id, ...context });

    return { tokens, user: this.sanitize(user) };
  }

  async refresh(
    userId: string,
    username: string,
    role: string,
    presentedRefreshToken: string,
    context: AuthContext,
  ): Promise<{ tokens: TokenPair; user: SanitizedUser }> {
    const user = await this.usersService.findByIdWithRefreshHash(userId);

    if (!user || !user.active || !user.refreshTokenHash) {
      this.logger.warn({
        event: 'refresh_failed',
        reason: 'no_session',
        userId,
        ...context,
      });
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(
      presentedRefreshToken,
      user.refreshTokenHash,
    );

    if (!matches) {
      // Posible reuso de un refresh token robado/expirado: se invalida la sesion.
      await this.usersService.setRefreshTokenHash(userId, null);
      this.logger.warn({
        event: 'refresh_failed',
        reason: 'hash_mismatch',
        userId,
        ...context,
      });
      throw new UnauthorizedException();
    }

    const tokens = await this.issueTokenPair(user);
    this.logger.log({ event: 'refresh_success', userId, ...context });

    return { tokens, user: this.sanitize(user) };
  }

  async logout(userId: string, context: AuthContext): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
    this.logger.log({ event: 'logout', userId, ...context });
  }

  sanitize(user: UserDocument): SanitizedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private async registerFailedAttempt(user: UserDocument): Promise<void> {
    const auth = this.configService.get('auth', { infer: true });
    const updated = await this.usersService.incrementFailedAttempts(user.id);

    if (updated && updated.failedLoginAttempts >= auth.maxAttempts) {
      const lockUntil = new Date(Date.now() + auth.lockoutMinutes * 60 * 1000);
      await this.usersService.setLockUntil(user.id, lockUntil);
      this.logger.warn({ event: 'account_locked', userId: user.id, lockUntil });
    }
  }

  private async issueTokenPair(user: UserDocument): Promise<TokenPair> {
    const jwt = this.configService.get('jwt', { infer: true });
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwt.secret,
      expiresIn: jwt.expiresIn as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: jwt.refreshSecret,
      expiresIn: jwt.refreshExpiresIn as JwtSignOptions['expiresIn'],
    });

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      REFRESH_HASH_ROUNDS,
    );
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash);

    const csrfToken = randomUUID();

    return { accessToken, refreshToken, csrfToken };
  }
}
