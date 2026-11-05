import { inject } from '@angular/core';
import { map } from 'rxjs';
import { CanActivateFn, Router } from '@angular/router';
import { Permissao } from '../models/permissoes';
import { AuthService } from '../services/auth.service';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { PermissaoService } from '../services/permissao.service';

/**
 * Protege a rota pela permissão declarada em `data: { permissao: 'modulo.recurso.acao' }` (ou uma lista: basta uma).
 * Sem permissão volta à página inicial segura com aviso. Sem empresa ativa libera: o shell trata esses estados.
 * Rota sem `data.permissao` não é restringida por este guard.
 */
export const permissaoGuard: CanActivateFn = route => {
  const exigida = route.data?.['permissao'] as Permissao | readonly Permissao[] | undefined;
  if (!exigida) return true;

  const auth = inject(AuthService);
  const empresa = inject(EmpresaAtivaService);
  const permissao = inject(PermissaoService);
  const router = inject(Router);
  // superadmin não usa telas de empresa
  if (auth.isSuperAdmin()) return router.createUrlTree(['/plataforma']);

  return empresa.garantirCarregada(auth.currentUser()?.sub ?? '').pipe(
    map(() => {
      if (!empresa.ativa() || permissao.pode(exigida)) return true;
      empresa.aviso.set('Seu perfil não permite acessar esta tela.');
      return router.createUrlTree([empresa.rotaInicial()]);
    })
  );
};
