import { inject } from '@angular/core';
import { map } from 'rxjs';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

/** Ao entrar na área Imobilizado, carrega as empresas do usuário (sempre atualizado). */
export const imobilizadoGuard: CanActivateFn = () => {
  return inject(EmpresaAtivaService).carregar().pipe(map(() => true));
};

/**
 * Rotas filhas exigem empresa ativa, salvo as marcadas com `data: { dispensaEmpresa: true }`
 * (início e administração de empresas).
 */
export const empresaAtivaGuard: CanActivateChildFn = (route) => {
  if (route.data['dispensaEmpresa']) return true;
  if (inject(EmpresaAtivaService).id() !== null) return true;
  return inject(Router).createUrlTree(['/imobilizado']);
};
