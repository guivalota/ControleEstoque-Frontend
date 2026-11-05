import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { empresaInterceptor } from './empresa.interceptor';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ToastService } from '../services/toast.service';

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

  afterEach(() => { ctrl.verify(); localStorage.removeItem('imob.empresaBloqueadaId'); });

  const base = '/api/v1/imobilizado';

  it('envia X-Empresa-Id nas chamadas de dados', () => {
    http.get(`${base}/locais`).subscribe();
    expect(ctrl.expectOne(`${base}/locais`).request.headers.get('X-Empresa-Id')).toBe('5');
  });

  it('envia o header em empresa/ativa e empresa/ativa/uso (não confundir com empresa/minhas)', () => {
    for (const url of ['/api/v1/empresa/ativa', '/api/v1/empresa/ativa/uso']) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.get('X-Empresa-Id')).toBe('5');
    }
  });

  it('não envia o header em empresa/minhas', () => {
    http.get('/api/v1/empresa/minhas').subscribe();
    expect(ctrl.expectOne('/api/v1/empresa/minhas').request.headers.has('X-Empresa-Id')).toBeFalse();
  });

  it('não envia o header na administração de empresas', () => {
    for (const url of [`${base}/empresas`, `${base}/empresas?page=1&pageSize=50`, `${base}/empresas/3/usuarios`]) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.has('X-Empresa-Id')).toBeFalse();
    }
  });

  it('envia o header nas rotas de Estoque, clientes, fornecedores e equipe', () => {
    for (const url of ['/api/v1/produtos?page=1', '/api/v1/categorias', '/api/v1/movimentacoes', '/api/v1/clientes', '/api/v1/fornecedores/1', '/api/v1/dashboard', '/api/v1/equipe']) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.get('X-Empresa-Id')).toBe('5');
    }
  });

  it('envia o header com URL absoluta da API', () => {
    const url = 'https://api.exemplo.com/v1/produtos';
    http.get(url).subscribe();
    expect(ctrl.expectOne(url).request.headers.get('X-Empresa-Id')).toBe('5');
  });

  it('envia o header no CEP e na lista de usuários da empresa ativa', () => {
    for (const url of ['/api/v1/cep/01001000', '/api/v1/empresa-ativa/usuarios?page=1']) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.get('X-Empresa-Id')).withContext(url).toBe('5');
    }
  });

  it('não envia o header em rotas sem empresa', () => {
    const urls = ['/api/v1/auth/login', '/api/v1/users/me', '/api/v1/users', '/api/v1/version', '/api/v1/plataforma/empresas',
      '/api/v1/audit-logs', `${base}/depreciacao/ajuda`, `${base}/depreciacao/ajuda/faq`, '/health'];
    for (const url of urls) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.has('X-Empresa-Id')).withContext(url).toBeFalse();
    }
  });

  it('sem empresa ativa em rota de Estoque não envia header e registra erro', () => {
    empresa.id.set(null);
    const erro = spyOn(console, 'error');
    http.get('/api/v1/produtos').subscribe();
    expect(ctrl.expectOne('/api/v1/produtos').request.headers.has('X-Empresa-Id')).toBeFalse();
    expect(erro).toHaveBeenCalled();
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

  it('403 de perfil insuficiente mantém a tela: toast com a mensagem do servidor e sem perdeuAcesso', () => {
    const perdeu = spyOn(empresa, 'perdeuAcesso');
    const toast = TestBed.inject(ToastService);
    const erro = spyOn(toast, 'erro');
    let status = 0;
    http.post(`${base}/bens`, {}).subscribe({ error: e => status = e.status });
    ctrl.expectOne(`${base}/bens`).flush({ error: 'Seu perfil não permite esta ação.' }, { status: 403, statusText: 'Forbidden' });
    expect(perdeu).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalledOnceWith('Seu perfil não permite esta ação.');
    expect(status).toBe(403);
  });

  it('403 de perda de vínculo não gera toast (volta ao seletor)', () => {
    spyOn(empresa, 'perdeuAcesso');
    const erro = spyOn(TestBed.inject(ToastService), 'erro');
    http.get(`${base}/locais`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${base}/locais`).flush({ error: 'Sem acesso à empresa informada.' }, { status: 403, statusText: 'Forbidden' });
    expect(erro).not.toHaveBeenCalled();
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

  it('403 empresa_bloqueada cai na tela sem acesso com a mensagem do servidor, sem perdeuAcesso', () => {
    const perdeu = spyOn(empresa, 'perdeuAcesso');
    http.get(`${base}/locais`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${base}/locais`).flush(
      { error: 'Empresa bloqueada. Fale com o administrador.', codigo: 'empresa_bloqueada' }, { status: 403, statusText: 'Forbidden' });
    expect(perdeu).not.toHaveBeenCalled();
    expect(empresa.bloqueadaMsg()).toBe('Empresa bloqueada. Fale com o administrador.');
    expect(empresa.semAcesso()).toBeTrue();
    expect(empresa.id()).toBeNull();
  });
});
