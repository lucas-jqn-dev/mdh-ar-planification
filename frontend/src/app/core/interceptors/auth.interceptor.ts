import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../services/token-store';

/** Agrega el access token (en memoria) como Authorization: Bearer en requests a nuestra API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStore = inject(TokenStore);
  const accessToken = tokenStore.accessToken();

  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (!isApiRequest || !accessToken) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` },
    }),
  );
};
