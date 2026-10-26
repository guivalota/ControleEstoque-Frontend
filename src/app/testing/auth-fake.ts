import { Provider, signal } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

/** Provider de teste: usuário logado com o papel informado (PermissaoService lê daqui). */
export function provideAuthFake(role: 'admin' | 'operador' | 'leitura'): Provider {
  return { provide: AuthService, useValue: { currentUser: signal({ role }) } };
}
