import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Protege rutas privadas. Si no hay access token en memoria (p.ej. tras un
 * reload de pagina), intenta un refresh silencioso via la cookie HttpOnly
 * antes de redirigir a /login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return authService.refresh().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
