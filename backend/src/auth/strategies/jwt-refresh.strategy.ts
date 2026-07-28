import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';
import { JwtPayload } from './jwt.strategy';

export interface RefreshTokenRequestPayload extends JwtPayload {
  refreshToken: string;
}

function extractFromCookie(req: Request): string | null {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  return token ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RefreshTokenRequestPayload {
    const refreshToken = extractFromCookie(req);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return { ...payload, refreshToken };
  }
}
