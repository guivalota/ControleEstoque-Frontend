import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

const API = /\/v1\//;
// Rotas sem [RequerEmpresa] (não enviam o header); toda outra rota /v1/** é dado de empresa.
const SEM_EMPRESA = /\/v1\/(auth|users|plataforma|audit-logs|version|imobilizado\/(minhas-empresas|empresas|depreciacao\/ajuda))(?:[/?]|$)/;

function perdeuVinculo(err: HttpErrorResponse): boolean {
  const msg = (err.error as { error?: unknown } | null)?.error;
  return typeof msg !== 'string' || /sem acesso à empresa/i.test(msg);
}

export const empresaInterceptor: HttpInterceptorFn = (req, next) => {
  const empresa = inject(EmpresaAtivaService);
  const ehDados = API.test(req.url) && !SEM_EMPRESA.test(req.url);

  if (!ehDados) return next(req);

  const id = empresa.id();
  if (id !== null) {
    req = req.clone({ setHeaders: { 'X-Empresa-Id': String(id) } });
  } else {
    console.error('Chamada de dados sem empresa ativa:', req.url);
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const corpo = err.error as { error?: unknown; codigo?: unknown } | null;
      if (err.status === 403 && corpo?.codigo === 'empresa_bloqueada') {
        empresa.empresaBloqueada(typeof corpo.error === 'string' && corpo.error ? corpo.error : 'Empresa bloqueada. Fale com o administrador.');
        return throwError(() => err);
      }
      // 403 por perfil/equipe/dono da OS traz a regra em `error` e mantém a tela; só a perda de vínculo volta ao seletor.
      if (err.status === 403 && perdeuVinculo(err)) empresa.perdeuAcesso();
      return throwError(() => err);
    })
  );
};
