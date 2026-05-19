import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, TokenResponse, JwtPayload } from '../models/auth.model';

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
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.accessToken);
        localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
        this._currentUser.set(this.decodeToken(res.accessToken));
      })
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  refreshToken() {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) return null;
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.accessToken);
        localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
        this._currentUser.set(this.decodeToken(res.accessToken));
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
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
