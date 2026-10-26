import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

const AREA = '/v1/imobilizado/';
const SEM_EMPRESA = /\/v1\/imobilizado\/(minhas-empresas|empresas)(?:[/?]|$)/;

function perdeuVinculo(err: HttpErrorResponse): boolean {
  const msg = (err.error as { error?: unknown } | null)?.error;
  return typeof msg !== 'string' || /sem acesso à empresa/i.test(msg);
}

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
      // 403 por perfil/equipe/dono da OS traz a regra em `error` e mantém a tela; só a perda de vínculo volta ao seletor.
      if (err.status === 403 && perdeuVinculo(err)) empresa.perdeuAcesso();
      return throwError(() => err);
    })
  );
};
