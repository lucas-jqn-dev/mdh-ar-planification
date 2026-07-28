import { Injectable, computed, signal } from '@angular/core';
import { User } from '../../models/user.model';

/**
 * Guarda el access token y el usuario actual solo en memoria (nunca en
 * localStorage/sessionStorage) para reducir la superficie de robo via XSS.
 * Se pierde al recargar la pagina; AuthService lo repone via /auth/refresh.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly currentUserSignal = signal<User | null>(null);

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);

  setSession(accessToken: string, user: User): void {
    this.accessTokenSignal.set(accessToken);
    this.currentUserSignal.set(user);
  }

  updateAccessToken(accessToken: string): void {
    this.accessTokenSignal.set(accessToken);
  }

  clear(): void {
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
  }
}
