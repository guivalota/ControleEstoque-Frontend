import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissaoService } from '../services/permissao.service';

/**
 * Telas de administração da empresa: vale o PERFIL EFETIVO na empresa ativa (a conta cliente tem role
 * global `leitura`, o poder vem do vínculo). A empresa já foi carregada por `cargaEmpresaGuard` (rota pai).
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const permissao = inject(PermissaoService);
  const router = inject(Router);
  // superadmin não é "admin de empresa": nunca entra nas telas de negócio
  if (auth.isSuperAdmin()) return router.createUrlTree(['/plataforma']);
  if (permissao.perfil() === 'admin') return true;
  return router.createUrlTree(['/dashboard']);
};
