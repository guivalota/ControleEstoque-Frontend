import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError(err => {
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      const refresh$ = authService.refreshToken();
      if (!refresh$) {
        authService.logout();
        return throwError(() => err);
      }

      return refresh$.pipe(
        switchMap(() => {
          const token = authService.getToken();
          const retried = token
            ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
            : req;
          return next(retried);
        }),
        catchError(refreshErr => {
          if (refreshErr?.status === 403 && refreshErr?.error?.codigo === 'empresa_bloqueada') {
            authService.avisoLogin.set(refreshErr.error.error || 'Empresa bloqueada. Fale com o administrador.');
          }
          authService.logout();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
