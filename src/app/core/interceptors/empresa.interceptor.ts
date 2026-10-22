import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

const AREA = '/v1/imobilizado/';
const SEM_EMPRESA = /\/v1\/imobilizado\/(minhas-empresas|empresas)(?:[/?]|$)/;

export const empresaInterceptor: HttpInterceptorFn = (req, next) => {
  const empresa = inject(EmpresaAtivaService);
  const ehDados = req.url.includes(AREA) && !SEM_EMPRESA.test(req.url);

  if (!ehDados) return next(req);

  const id = empresa.id();
  if (id !== null) {
    req = req.clone({ setHeaders: { 'X-Empresa-Id': String(id) } });
  } else {
    console.error('Chamada de dados do Imobilizado sem empresa ativa:', req.url);
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403) empresa.perdeuAcesso();
      return throwError(() => err);
    })
  );
};
