import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../auth.constants';

/**
 * Proteccion CSRF de doble-submit para endpoints que dependen de la cookie
 * HttpOnly de refresh token (el navegador la envia automaticamente en
 * requests cross-site; el header solo lo puede setear JS del mismo origen).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME] as
      string | undefined;
    const headerToken = request.headers[CSRF_HEADER_NAME.toLowerCase()];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Token CSRF invalido o ausente');
    }

    return true;
  }
}
