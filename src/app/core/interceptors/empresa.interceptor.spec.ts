import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { empresaInterceptor } from './empresa.interceptor';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

describe('empresaInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let empresa: EmpresaAtivaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([empresaInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    empresa = TestBed.inject(EmpresaAtivaService);
    empresa.id.set(5);
  });

  afterEach(() => ctrl.verify());

  const base = '/api/v1/imobilizado';

  it('envia X-Empresa-Id nas chamadas de dados', () => {
    http.get(`${base}/locais`).subscribe();
    expect(ctrl.expectOne(`${base}/locais`).request.headers.get('X-Empresa-Id')).toBe('5');
  });

  it('envia o header em empresa-ativa (não confundir com empresas/**)', () => {
    http.get(`${base}/empresa-ativa`).subscribe();
    expect(ctrl.expectOne(`${base}/empresa-ativa`).request.headers.get('X-Empresa-Id')).toBe('5');
  });

  it('não envia o header em minhas-empresas', () => {
    http.get(`${base}/minhas-empresas`).subscribe();
    expect(ctrl.expectOne(`${base}/minhas-empresas`).request.headers.has('X-Empresa-Id')).toBeFalse();
  });

  it('não envia o header na administração de empresas', () => {
    for (const url of [`${base}/empresas`, `${base}/empresas?page=1&pageSize=50`, `${base}/empresas/3/usuarios`]) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.has('X-Empresa-Id')).toBeFalse();
    }
  });

  it('não mexe em chamadas fora da área Imobilizado', () => {
    http.get('/api/v1/produtos').subscribe();
    expect(ctrl.expectOne('/api/v1/produtos').request.headers.has('X-Empresa-Id')).toBeFalse();
  });

  it('sem empresa ativa não envia header e registra erro no console', () => {
    empresa.id.set(null);
    const erro = spyOn(console, 'error');
    http.get(`${base}/locais`).subscribe();
    expect(ctrl.expectOne(`${base}/locais`).request.headers.has('X-Empresa-Id')).toBeFalse();
    expect(erro).toHaveBeenCalled();
  });

  it('403 em chamada de dados aciona perdeuAcesso e repassa o erro', () => {
    const perdeu = spyOn(empresa, 'perdeuAcesso');
    let status = 0;
    http.get(`${base}/locais`).subscribe({ error: e => status = e.status });
    ctrl.expectOne(`${base}/locais`).flush({ error: 'Sem acesso à empresa informada.' }, { status: 403, statusText: 'Forbidden' });
    expect(perdeu).toHaveBeenCalledTimes(1);
    expect(status).toBe(403);
  });

  it('403 na administração de empresas não aciona perdeuAcesso', () => {
    const perdeu = spyOn(empresa, 'perdeuAcesso');
    http.get(`${base}/empresas`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${base}/empresas`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(perdeu).not.toHaveBeenCalled();
  });

  it('outros erros (ex.: 400) não acionam perdeuAcesso', () => {
    const perdeu = spyOn(empresa, 'perdeuAcesso');
    http.get(`${base}/locais`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${base}/locais`).flush({ error: 'x' }, { status: 400, statusText: 'Bad Request' });
    expect(perdeu).not.toHaveBeenCalled();
  });
});
