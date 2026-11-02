import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { PermissaoService } from '../services/permissao.service';

/** Clientes não é do perfil contador (a API responde 403): volta à página inicial com aviso, em vez de abrir uma lista vazia. */
export const clientesGuard: CanActivateFn = () => {
  const permissao = inject(PermissaoService);
  const empresa = inject(EmpresaAtivaService);
  const router = inject(Router);
  if (permissao.podeUsarClientes()) return true;
  empresa.aviso.set('O perfil Contador não acessa o cadastro de clientes.');
  return router.createUrlTree([empresa.rotaInicial()]);
};
