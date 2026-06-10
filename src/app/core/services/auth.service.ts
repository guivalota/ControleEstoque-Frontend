import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, TokenResponse, JwtPayload, ForgotPasswordRequest, ResetPasswordRequest } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly TOKEN_KEY = 'ce_token';
  private readonly REFRESH_KEY = 'ce_refresh';

  private _currentUser = signal<JwtPayload | null>(this.decodeToken(this.getToken()));

  currentUser = this._currentUser.asReadonly();

  isAuthenticated = computed(() => {
    const user = this._currentUser();
    if (!user) return false;
    return user.exp * 1000 > Date.now();
  });

  login(req: LoginRequest) {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/v1/auth/login`, req).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.accessToken);
        localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
        this._currentUser.set(this.decodeToken(res.accessToken));
      })
    );
  }

  logout() {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/v1/auth/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private refreshInProgress$: Observable<TokenResponse> | null = null;

  refreshToken() {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) return null;

    // Compartilha o refresh em andamento entre requisições concorrentes: se várias
    // chamadas recebem 401 ao mesmo tempo, todas reusam a mesma chamada a /v1/auth/refresh
    // em vez de cada uma consumir o refresh token e derrubar a sessão das demais.
    if (!this.refreshInProgress$) {
      this.refreshInProgress$ = this.http.post<TokenResponse>(`${environment.apiUrl}/v1/auth/refresh`, { refreshToken }).pipe(
        tap(res => {
          localStorage.setItem(this.TOKEN_KEY, res.accessToken);
          localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
          this._currentUser.set(this.decodeToken(res.accessToken));
        }),
        finalize(() => this.refreshInProgress$ = null),
        shareReplay(1)
      );
    }

    return this.refreshInProgress$;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  forgotPassword(req: ForgotPasswordRequest) {
    return this.http.post(`${environment.apiUrl}/v1/auth/forgot-password`, req);
  }

  resetPassword(req: ResetPasswordRequest) {
    return this.http.post(`${environment.apiUrl}/v1/auth/reset-password`, req);
  }

  patchCurrentUser(patch: { nome?: string; email?: string }) {
    const current = this._currentUser();
    if (current) this._currentUser.set({ ...current, ...patch });
  }

  private decodeToken(token: string | null): JwtPayload | null {
    if (!token) return null;
    try {
      const raw = JSON.parse(atob(token.split('.')[1]));
      return {
        sub: raw.sub,
        email: raw.email,
        nome: raw['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? raw.email,
        role: raw['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? '',
        exp: raw.exp
      };
    } catch {
      return null;
    }
  }
}
