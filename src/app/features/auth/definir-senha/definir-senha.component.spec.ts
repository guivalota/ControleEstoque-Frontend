import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DefinirSenhaComponent } from './definir-senha.component';
import { AuthService } from '../../../core/services/auth.service';

describe('DefinirSenhaComponent', () => {
  let fixture: ComponentFixture<DefinirSenhaComponent>;
  let comp: DefinirSenhaComponent;
  let ctrl: HttpTestingController;
  let router: Router;
  const authFake = {
    currentUser: () => ({ nome: 'Ana', email: 'ana@x.com', role: 'admin' }),
    refreshToken: jasmine.createSpy('refreshToken'),
    encerrarSessaoLocal: jasmine.createSpy('encerrar'),
    marcarTrocaSenhaPendente: jasmine.createSpy('marcar'),
    destinoInicial: () => '/dashboard',
    logout: jasmine.createSpy('logout')
  };

  beforeEach(() => {
    authFake.refreshToken.calls.reset();
    authFake.marcarTrocaSenhaPendente.calls.reset();
    authFake.encerrarSessaoLocal.calls.reset();
    TestBed.configureTestingModule({
      imports: [DefinirSenhaComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: authFake }]
    });
    fixture = TestBed.createComponent(DefinirSenhaComponent);
    comp = fixture.componentInstance;
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => ctrl.verify());

  it('rejeita senha fraca e divergente sem chamar a API', () => {
    comp.form.setValue({ novaSenha: 'fraca', confirmarSenha: 'outra' });
    comp.submit();
    expect(comp.field('novaSenha').hasError('passwordStrength')).toBeTrue();
    expect(comp.form.hasError('passwordsMismatch')).toBeTrue();
    expect(comp.field('novaSenha').touched).toBeTrue();
    ctrl.expectNone('/api/v1/users/me');
  });

  it('aceita senha forte e confirmação igual', () => {
    comp.form.setValue({ novaSenha: 'Senha@123', confirmarSenha: 'Senha@123' });
    expect(comp.form.valid).toBeTrue();
  });

  it('envia PUT users/me com nome, email e senha, encerra a sessão local e vai ao login sem refresh', () => {
    comp.form.setValue({ novaSenha: 'Senha@123', confirmarSenha: 'Senha@123' });
    comp.submit();
    const req = ctrl.expectOne('/api/v1/users/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@x.com', senha: 'Senha@123' });
    req.flush({});
    expect(authFake.refreshToken).not.toHaveBeenCalled();
    ctrl.expectNone('/api/v1/auth/refresh');
    expect(authFake.encerrarSessaoLocal).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { senhaDefinida: '1' } });
  });

  it('mostra o erro do servidor e libera o botão', () => {
    comp.form.setValue({ novaSenha: 'Senha@123', confirmarSenha: 'Senha@123' });
    comp.submit();
    ctrl.expectOne('/api/v1/users/me').flush({ error: 'Senha inválida.' }, { status: 400, statusText: 'Bad' });
    expect(comp.error()).toBe('Senha inválida.');
    expect(comp.loading()).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(authFake.encerrarSessaoLocal).not.toHaveBeenCalled();
  });

  it('401 no PUT encerra a sessão local e leva ao login', () => {
    comp.form.setValue({ novaSenha: 'Senha@123', confirmarSenha: 'Senha@123' });
    comp.submit();
    ctrl.expectOne('/api/v1/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(authFake.encerrarSessaoLocal).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
