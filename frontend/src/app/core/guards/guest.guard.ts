import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Evita mostrar /login si ya existe una sesion valida (activa o recuperable via refresh). */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/home']);
  }

  return authService.refresh().pipe(
    map(() => router.createUrlTree(['/home'])),
    catchError(() => of(true)),
  );
};
