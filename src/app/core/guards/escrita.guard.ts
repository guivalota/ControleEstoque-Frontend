import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissaoService } from '../services/permissao.service';

/** Telas de criação/edição do Imobilizado: só admin e operador (leitura volta para a lista de bens). */
export const escritaGuard: CanActivateFn = () => {
  if (inject(PermissaoService).canEdit()) return true;
  return inject(Router).createUrlTree(['/imobilizado/bens']);
};
