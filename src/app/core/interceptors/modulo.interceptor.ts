import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, throwError } from 'rxjs';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

const MENSAGENS: Record<string, string> = {
  modulo_desativado: 'Seu plano não inclui este módulo.',
  modulo_nao_permitido: 'Você não tem acesso a este módulo.',
  modulo_nao_declarado: 'Você não tem acesso a este módulo.'
};

/**
 * 403 `{ codigo: 'modulo_desativado' | 'modulo_nao_permitido' | 'modulo_nao_declarado', modulo }`: o módulo não está
 * disponível para a empresa/usuário. Não é erro de tela nem perda de vínculo: avisa, recarrega os módulos da
 * empresa e leva à página inicial segura. Fica depois do empresaInterceptor na lista, para ele não ver este 403.
 */
export const moduloInterceptor: HttpInterceptorFn = (req, next) => {
  const empresa = inject(EmpresaAtivaService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      const e = err as HttpErrorResponse;
      const codigo = e?.status === 403 ? (e.error as { codigo?: unknown } | null)?.codigo : undefined;
      const mensagem = typeof codigo === 'string' ? MENSAGENS[codigo] : undefined;
      if (!mensagem) return throwError(() => err);

      const modulo = (e.error as { modulo?: unknown }).modulo;
      empresa.aviso.set(mensagem);
      empresa.carregar().subscribe(() => {
        const destino = empresa.rotaInicial(typeof modulo === 'string' ? modulo : undefined);
        if (router.url.split('?')[0] !== destino) router.navigateByUrl(destino);
      });
      return EMPTY;
    })
  );
};
