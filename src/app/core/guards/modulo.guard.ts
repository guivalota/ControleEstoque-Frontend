import { inject } from '@angular/core';
import { map } from 'rxjs';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { PermissaoService } from '../services/permissao.service';

/**
 * Rota de módulo (`estoque`, `imobilizado`): sem o módulo na empresa ativa volta à página inicial segura.
 * Sem empresa ativa (sem acesso, seleção pendente ou erro de carga) libera: o shell trata esses estados.
 */
export function moduloGuard(codigo: string): CanActivateFn {
  return (_route, state) => {
    const empresa = inject(EmpresaAtivaService);
    const router = inject(Router);
    const permissao = inject(PermissaoService);
    const dono = inject(AuthService).currentUser()?.sub ?? '';
    return empresa.garantirCarregada(dono).pipe(
      map(() => {
        // perfil sem nenhuma tela do Estoque (ex.: contador) não o usa
        if (codigo === 'estoque' && empresa.ativa() && !permissao.podeUsarModulo('estoque')) {
          empresa.aviso.set('Seu perfil não acessa o Estoque.');
          return router.createUrlTree([empresa.rotaInicial(codigo)]);
        }
        if (!empresa.ativa() || empresa.temModulo(codigo)) return true;
        // `/dashboard` é só a entrada padrão (login e raiz): empresa sem Estoque segue para a própria página inicial, sem aviso
        if (codigo === 'estoque' && state?.url?.split('?')[0] === '/dashboard') return router.createUrlTree([empresa.rotaInicial(codigo)]);
        // também no recarregamento: o aviso explica o redirecionamento
        empresa.aviso.set('Seu plano não inclui este módulo.');
        return router.createUrlTree([empresa.rotaInicial(codigo)]);
      })
    );
  };
}
