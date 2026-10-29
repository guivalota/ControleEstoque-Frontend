import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Áreas de empresa (Estoque, Imobilizado, manual): o super administrador nunca as abre, vai para /plataforma. */
export const contaEmpresaGuard: CanActivateFn = () => {
  if (!inject(AuthService).isSuperAdmin()) return true;
  return inject(Router).createUrlTree(['/plataforma']);
};

/** Painel da plataforma: só o super administrador; conta de empresa volta ao dashboard. */
export const superAdminGuard: CanActivateFn = () => {
  if (inject(AuthService).isSuperAdmin()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};
