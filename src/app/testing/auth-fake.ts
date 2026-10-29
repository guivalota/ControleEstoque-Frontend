import { Provider, signal } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

export type RoleFake = 'admin' | 'operador' | 'leitura' | 'superadmin';

/** Provider de teste: usuário logado com o papel informado (PermissaoService e guards leem daqui). */
export function provideAuthFake(role: RoleFake): Provider {
  const currentUser = signal({ role, nome: 'Fulano', email: 'fulano@x.com' });
  return {
    provide: AuthService,
    useValue: {
      currentUser,
      isSuperAdmin: () => role === 'superadmin',
      precisaTrocarSenha: signal(false),
      destinoInicial: () => (role === 'superadmin' ? '/plataforma' : '/dashboard'),
      logout: () => undefined
    }
  };
}
