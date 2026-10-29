import { inject } from '@angular/core';
import { map } from 'rxjs';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

/**
 * Rotas autenticadas de conta de empresa: carrega a empresa ativa (qualquer módulo) antes de ativar
 * telas de dados, para o X-Empresa-Id existir desde a primeira chamada. Falha de carga não bloqueia:
 * o shell mostra o erro com "Tentar novamente".
 */
export const cargaEmpresaGuard: CanActivateFn = () => {
  const dono = inject(AuthService).currentUser()?.sub ?? '';
  return inject(EmpresaAtivaService).garantirCarregada(dono).pipe(map(() => true));
};
