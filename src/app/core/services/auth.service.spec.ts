import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';

function jwt(claims: Record<string, unknown>): string {
  const payload = { sub: '1', email: 'a@x.com', [NAME]: 'Ana', exp: Math.floor(Date.now() / 1000) + 3600, ...claims };
  return `h.${btoa(JSON.stringify(payload))}.s`;
}

describe('AuthService (senha provisória e tipo de conta)', () => {
  let ctrl: HttpTestingController;

  function criar(tokenInicial?: string) {
    localStorage.clear();
    if (tokenInicial) localStorage.setItem('ce_token', tokenInicial);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  afterEach(() => localStorage.clear());

  it('login com precisaTrocarSenha marca a pendência e aponta para /definir-senha', () => {
    const auth = criar();
    auth.login({ email: 'a@x.com', senha: 'x' }).subscribe();
    ctrl.expectOne('/api/v1/auth/login').flush({ accessToken: jwt({ [ROLE]: 'admin' }), refreshToken: 'r', precisaTrocarSenha: true });
    expect(auth.precisaTrocarSenha()).toBeTrue();
    expect(auth.destinoInicial()).toBe('/definir-senha');
  });

  it('login normal de conta de empresa vai para /dashboard', () => {
    const auth = criar();
    auth.login({ email: 'a@x.com', senha: 'x' }).subscribe();
    ctrl.expectOne('/api/v1/auth/login').flush({ accessToken: jwt({ [ROLE]: 'admin' }), refreshToken: 'r', precisaTrocarSenha: false });
    expect(auth.precisaTrocarSenha()).toBeFalse();
    expect(auth.isSuperAdmin()).toBeFalse();
    expect(auth.destinoInicial()).toBe('/dashboard');
  });

  it('superadmin vai para /plataforma', () => {
    const auth = criar();
    auth.login({ email: 'a@x.com', senha: 'x' }).subscribe();
    ctrl.expectOne('/api/v1/auth/login').flush({ accessToken: jwt({ [ROLE]: 'superadmin' }), refreshToken: 'r' });
    expect(auth.isSuperAdmin()).toBeTrue();
    expect(auth.destinoInicial()).toBe('/plataforma');
  });

  it('decodifica nome e role do token; a pendência de senha não vem do JWT', () => {
    const auth = criar(jwt({ [ROLE]: 'superadmin', trocar_senha: 'true' }));
    expect(auth.currentUser()?.nome).toBe('Ana');
    expect(auth.isSuperAdmin()).toBeTrue();
    expect(auth.precisaTrocarSenha()).toBeFalse();
  });

  it('refresh atualiza a pendência (senha já trocada)', () => {
    const auth = criar(jwt({}));
    auth.marcarTrocaSenhaPendente();
    localStorage.setItem('ce_refresh', 'r');
    auth.refreshToken()!.subscribe();
    ctrl.expectOne('/api/v1/auth/refresh').flush({ accessToken: jwt({}), refreshToken: 'r2', precisaTrocarSenha: false });
    expect(auth.precisaTrocarSenha()).toBeFalse();
  });
  it('encerrarSessaoLocal limpa tokens, usuário e pendência sem chamar a API', () => {
    const auth = criar(jwt({}));
    localStorage.setItem('ce_refresh', 'r');
    auth.marcarTrocaSenhaPendente();
    auth.encerrarSessaoLocal();
    expect(auth.getToken()).toBeNull();
    expect(localStorage.getItem('ce_refresh')).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(auth.precisaTrocarSenha()).toBeFalse();
    ctrl.verify();
  });
});
