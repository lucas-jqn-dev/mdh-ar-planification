import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../../models/auth.model';
import { TokenStore } from './token-store';
import { getCookie } from '../utils/cookie.util';
import { SKIP_AUTH_REFRESH } from '../interceptors/refresh.interceptor';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStore = inject(TokenStore);

  readonly isAuthenticated = this.tokenStore.isAuthenticated;
  readonly currentUser = this.tokenStore.currentUser;

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials, { withCredentials: true })
      .pipe(tap((response) => this.tokenStore.setSession(response.accessToken, response.user)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload, { withCredentials: true })
      .pipe(tap((response) => this.tokenStore.setSession(response.accessToken, response.user)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(
        `${environment.apiUrl}/auth/logout`,
        {},
        { withCredentials: true, headers: this.csrfHeaders() },
      )
      .pipe(tap(() => this.tokenStore.clear()));
  }

  /** Intenta renovar la sesion usando la cookie HttpOnly de refresh token. */
  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: this.csrfHeaders(),
          context: new HttpContext().set(SKIP_AUTH_REFRESH, true),
        },
      )
      .pipe(tap((response) => this.tokenStore.setSession(response.accessToken, response.user)));
  }

  private csrfHeaders(): Record<string, string> {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    return csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {};
  }
}
