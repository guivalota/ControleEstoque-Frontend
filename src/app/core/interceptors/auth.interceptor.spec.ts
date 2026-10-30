import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let token: string | null;

  beforeEach(() => {
    token = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => token } }
      ]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('envia Authorization quando há token e nenhum header ngrok', () => {
    token = 'abc';
    http.get('/x').subscribe();
    const req = ctrl.expectOne('/x');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    expect(req.request.headers.keys().some(k => k.toLowerCase().startsWith('ngrok'))).toBeFalse();
    req.flush({});
  });

  it('não envia Authorization sem token', () => {
    http.get('/x').subscribe();
    const req = ctrl.expectOne('/x');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.keys().length).toBe(0);
    req.flush({});
  });
});
