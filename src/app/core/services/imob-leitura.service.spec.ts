import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobLeituraService } from './imob-leitura.service';
import { ImobConciliacaoService } from './imob-conciliacao.service';
import { ImobInventarioService } from './imob-inventario.service';

const BASE = '/api/v1/imobilizado/inventarios/7';

describe('Serviços de inventário (leituras, conciliação, encerramento)', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('registra leitura enviando o clientId', () => {
    TestBed.inject(ImobLeituraService).registrar(7, { plaqueta: 'NB-1', localId: 3, clientId: 'abc' }).subscribe();
    const req = ctrl.expectOne(`${BASE}/leituras`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plaqueta: 'NB-1', localId: 3, clientId: 'abc' });
    req.flush({});
  });

  it('lista leituras só com filtros definidos', () => {
    TestBed.inject(ImobLeituraService).listar(7, { plaqueta: 'NB', incluirAnuladas: true, page: 2 }).subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/leituras`);
    expect(req.request.params.get('plaqueta')).toBe('NB');
    expect(req.request.params.get('incluirAnuladas')).toBe('true');
    expect(req.request.params.has('localId')).toBeFalse();
    req.flush({ items: [], page: 2, pageSize: 50, total: 0 });
  });

  it('importa CSV com apenasValidar e local padrão em multipart', () => {
    const arquivo = new File(['plaqueta\nNB-1'], 'l.csv', { type: 'text/csv' });
    TestBed.inject(ImobLeituraService).importar(7, arquivo, true, 4).subscribe();
    const req = ctrl.expectOne(`${BASE}/leituras/importacao`);
    const form = req.request.body as FormData;
    expect(form.get('apenasValidar')).toBe('true');
    expect(form.get('localPadraoId')).toBe('4');
    expect(form.get('arquivo')).toBeTruthy();
    req.flush({});
  });

  it('resolve e reabre divergências', () => {
    const svc = TestBed.inject(ImobConciliacaoService);
    svc.resolver(7, { plaqueta: 'D1', acao: 'manter' }).subscribe();
    ctrl.expectOne(`${BASE}/conciliacao/resolver`).flush({});
    svc.reabrir(7, 'D1').subscribe();
    const req = ctrl.expectOne(`${BASE}/conciliacao/reabrir`);
    expect(req.request.body).toEqual({ plaqueta: 'D1' });
    req.flush({});
  });

  it('encerra enviando confirmarPendencias', () => {
    TestBed.inject(ImobInventarioService).encerrar(7, true).subscribe();
    const req = ctrl.expectOne(`${BASE}/encerrar`);
    expect(req.request.body).toEqual({ confirmarPendencias: true });
    req.flush({});
  });

  it('baixa o relatório como blob com o formato escolhido', () => {
    let nome = '';
    TestBed.inject(ImobInventarioService).relatorio(7, 'csv').subscribe(a => nome = a.nome);
    const req = ctrl.expectOne(r => r.url === `${BASE}/relatorio`);
    expect(req.request.params.get('formato')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
    expect(nome).toBe('inventario-7.csv');
  });
});
