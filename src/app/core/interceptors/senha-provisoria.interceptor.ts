import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * 403 `{ precisaTrocarSenha: true }`: a conta tem senha provisória e o servidor bloqueia tudo
 * até a troca. Não é erro de tela: leva o usuário para /definir-senha.
 */
export const senhaProvisoriaInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      const e = err as HttpErrorResponse;
      if (e?.status === 403 && e.error?.precisaTrocarSenha === true) {
        auth.marcarTrocaSenhaPendente();
        if (!router.url.startsWith('/definir-senha')) router.navigate(['/definir-senha']);
        return EMPTY;
      }
      return throwError(() => err);
    })
  );
};
