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

  it('obtém o detalhe da conferência de um bem', () => {
    TestBed.inject(ImobConferenciaService).obter(7, 42).subscribe();
    const req = ctrl.expectOne(`${BASE}/42`);
    expect(req.request.method).toBe('GET');
    req.flush({ bemId: 42, eventos: [] });
  });

  it('fotos de evidência: lista, envia (multipart com origem), exclui e baixa o conteúdo', () => {
    const s = TestBed.inject(ImobConferenciaService);

    s.fotos(7, 42).subscribe();
    ctrl.expectOne(`${BASE}/42/fotos`).flush([]);

    s.enviarFoto(7, 42, new File(['x'], 'ev.jpg', { type: 'image/jpeg' })).subscribe();
    const envio = ctrl.expectOne(`${BASE}/42/fotos`);
    expect(envio.request.method).toBe('POST');
    const form = envio.request.body as FormData;
    expect((form.get('arquivo') as File).name).toBe('ev.jpg');
    expect(form.get('origem')).toBe('web');
    envio.flush({ id: 1 });

    s.excluirFoto(7, 42, 1).subscribe();
    const del = ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/42/fotos/1`);
    expect(del.request.params.get('origem')).toBe('web');
    del.flush(null, { status: 204, statusText: 'No Content' });

    s.conteudoFoto(7, 42, 1).subscribe();
    const conteudo = ctrl.expectOne(`${BASE}/42/fotos/1/conteudo`);
    expect(conteudo.request.responseType).toBe('blob');
    conteudo.flush(new Blob(['img']));
  });
  it('histórico do bem: lista as conferências do bem com paginação', () => {
    TestBed.inject(ImobConferenciaService).doBem(42, 2, 10).subscribe();
    const req = ctrl.expectOne(r => r.url === '/api/v1/imobilizado/bens/42/conferencias');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ items: [], page: 2, pageSize: 10, total: 0 });
  });
});
