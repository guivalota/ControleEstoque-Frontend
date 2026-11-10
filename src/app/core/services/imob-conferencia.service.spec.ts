import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobConferenciaService } from './imob-conferencia.service';

const BASE = '/api/v1/imobilizado/inventarios/7/conferencias';

describe('ImobConferenciaService', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('lista as conferências só com os filtros definidos', () => {
    TestBed.inject(ImobConferenciaService).listar(7, { situacao: 'incompletos', busca: 'nb', page: 2 }).subscribe();
    const req = ctrl.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('situacao')).toBe('incompletos');
    expect(req.request.params.get('busca')).toBe('nb');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('pageSize')).toBeFalse();
    req.flush({ items: [], page: 2, pageSize: 20, total: 0, resumo: {} });
  });

  it('envia o lote em { itens } por plaqueta', () => {
    TestBed.inject(ImobConferenciaService).enviarLote(7, [{ plaqueta: 'NB-1', estadoId: 2, valorMercado: 150.5 }]).subscribe();
    const req = ctrl.expectOne(`${BASE}/lote`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itens: [{ plaqueta: 'NB-1', estadoId: 2, valorMercado: 150.5 }] });
    req.flush({ gravadas: 1, ignoradas: 0, foraDoEsperado: 0, comErro: 0, itens: [] });
  });

  it('importa CSV em multipart com apenasValidar', () => {
    const arquivo = new File(['plaqueta;estado\nNB-1;Bom'], 'c.csv', { type: 'text/csv' });
    TestBed.inject(ImobConferenciaService).importar(7, arquivo, true).subscribe();
    const req = ctrl.expectOne(`${BASE}/importacao`);
    const form = req.request.body as FormData;
    expect(form.get('apenasValidar')).toBe('true');
    expect(form.get('arquivo')).toBeTruthy();
    req.flush({});
  });

  it('baixa o modelo usando o nome do Content-Disposition', () => {
    let nome = '';
    TestBed.inject(ImobConferenciaService).modelo(7).subscribe(a => nome = a.nome);
    const req = ctrl.expectOne(`${BASE}/importacao/modelo`);
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="modelo-importacao-conferencias.csv"' } });
    expect(nome).toBe('modelo-importacao-conferencias.csv');
  });
});
