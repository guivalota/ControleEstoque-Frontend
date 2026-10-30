import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { PermissaoService } from '../services/permissao.service';

/**
 * Áreas só do admin da empresa (ex.: `/configuracoes`), independente de módulo (é Core): vale o perfil
 * efetivo na empresa ativa. Quem não é admin volta à página inicial segura com aviso (US-17-12).
 */
export const perfilAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const permissao = inject(PermissaoService);
  const empresa = inject(EmpresaAtivaService);
  const router = inject(Router);
  if (auth.isSuperAdmin()) return router.createUrlTree(['/plataforma']);
  if (permissao.perfil() === 'admin') return true;
  empresa.aviso.set('Apenas o administrador da empresa acessa as Configurações.');
  return router.createUrlTree([empresa.rotaInicial()]);
};
