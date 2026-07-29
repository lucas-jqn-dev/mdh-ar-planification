import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { AuthService, AuthContext, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CSRF_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from './auth.constants';
import { RefreshTokenRequestPayload } from './strategies/jwt-refresh.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.login(
      dto.identifier,
      dto.password,
      this.context(req),
    );
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.register(
      dto,
      this.context(req),
    );
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @UseGuards(JwtRefreshGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = req.user as RefreshTokenRequestPayload;
    const { tokens, user } = await this.authService.refresh(
      payload.sub,
      payload.username,
      payload.role,
      payload.refreshToken,
      this.context(req),
    );
    this.setAuthCookies(res, tokens);
    return { accessToken: tokens.accessToken, user };
  }

  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: UserDocument,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id, this.context(req));
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: UserDocument) {
    return this.authService.sanitize(user);
  }

  private context(req: Request): AuthContext {
    return {
      ip: req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    };
  }

  private setAuthCookies(res: Response, tokens: TokenPair): void {
    const isProduction =
      this.configService.get('nodeEnv', { infer: true }) === 'production';

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      // "/api/auth", no "/auth": el global prefix ("api", ver main.ts) hace
      // que el endpoint real sea /api/auth/refresh — el path de la cookie
      // tiene que calzar con eso o el browser no la manda en esa request.
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie(CSRF_COOKIE_NAME, tokens.csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/api/auth' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
  }
}
