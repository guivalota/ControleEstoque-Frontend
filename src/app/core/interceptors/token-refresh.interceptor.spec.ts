import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, throwError } from 'rxjs';
import { tokenRefreshInterceptor } from './token-refresh.interceptor';
import { AuthService } from '../services/auth.service';

describe('tokenRefreshInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([tokenRefreshInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => { ctrl.verify(); localStorage.removeItem('imob.empresaBloqueadaId'); });

  it('refresh recusado por empresa bloqueada deixa o aviso para o login e encerra a sessão', () => {
    spyOn(auth, 'refreshToken').and.returnValue(throwError(() => ({
      status: 403, error: { error: 'Empresa bloqueada. Fale com o administrador.', codigo: 'empresa_bloqueada' }
    })) as Observable<never>);
    const logout = spyOn(auth, 'logout');
    http.get('/api/v1/produtos').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/v1/produtos').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.avisoLogin()).toBe('Empresa bloqueada. Fale com o administrador.');
    expect(logout).toHaveBeenCalled();
  });

  it('outro erro de refresh não deixa aviso', () => {
    spyOn(auth, 'refreshToken').and.returnValue(throwError(() => ({ status: 401, error: {} })) as Observable<never>);
    spyOn(auth, 'logout');
    http.get('/api/v1/produtos').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/v1/produtos').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.avisoLogin()).toBe('');
  });
});
