import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { senhaProvisoriaInterceptor } from './senha-provisoria.interceptor';
import { AuthService } from '../services/auth.service';

describe('senhaProvisoriaInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([senhaProvisoriaInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => ctrl.verify());

  it('403 com precisaTrocarSenha redireciona e não propaga erro', () => {
    const erros: unknown[] = [];
    http.get('/api/v1/produtos').subscribe({ error: e => erros.push(e as { status: number }) });
    ctrl.expectOne('/api/v1/produtos').flush({ error: 'Troca de senha obrigatória', precisaTrocarSenha: true }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigate).toHaveBeenCalledWith(['/definir-senha']);
    expect(auth.precisaTrocarSenha()).toBeTrue();
    expect(erros.length).toBe(0);
  });

  it('403 comum segue como erro e não redireciona', () => {
    const erros: { status: number }[] = [];
    http.get('/api/v1/produtos').subscribe({ error: e => erros.push(e as { status: number }) });
    ctrl.expectOne('/api/v1/produtos').flush({ error: 'Sem permissão' }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(erros[0]?.status).toBe(403);
  });

  it('outros erros passam adiante', () => {
    const erros: { status: number }[] = [];
    http.get('/api/v1/produtos').subscribe({ error: e => erros.push(e as { status: number }) });
    ctrl.expectOne('/api/v1/produtos').flush({}, { status: 500, statusText: 'Err' });
    expect(erros[0]?.status).toBe(500);
  });
});
