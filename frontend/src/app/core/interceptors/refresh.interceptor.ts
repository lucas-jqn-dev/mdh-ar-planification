import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../../models/auth.model';
import { AuthService } from '../services/auth.service';
import { TokenStore } from '../services/token-store';

/** Marca un request para que el interceptor NO intente refrescar la sesion ante un 401. */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

let refreshInFlight: Observable<AuthResponse> | null = null;

/**
 * Ante un 401 en la API, intenta renovar la sesion una unica vez (via cookie
 * HttpOnly de refresh token) y reintenta el request original. Si el refresh
 * falla, limpia la sesion y redirige a /login.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenStore = inject(TokenStore);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const skip = req.context.get(SKIP_AUTH_REFRESH);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;

      if (!isApiRequest || skip || !isUnauthorized) {
        return throwError(() => error);
      }

      if (!refreshInFlight) {
        refreshInFlight = authService.refresh();
      }

      return refreshInFlight.pipe(
        switchMap((response) => {
          refreshInFlight = null;
          return next(
            req.clone({ setHeaders: { Authorization: `Bearer ${response.accessToken}` } }),
          );
        }),
        catchError((refreshError: unknown) => {
          refreshInFlight = null;
          tokenStore.clear();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
