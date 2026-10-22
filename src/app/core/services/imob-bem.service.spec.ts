import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobBemService } from './imob-bem.service';
import { lerErroApi } from '../utils/erros-api';

const BASE = '/api/v1/imobilizado/bens';

describe('ImobBemService', () => {
  let service: ImobBemService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobBemService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  describe('listar', () => {
    it('envia só os filtros definidos', () => {
      service.listar({ busca: 'nb', localId: 7, categoriaId: 3, status: 'ativo', page: 2, pageSize: 50 }).subscribe();
      const req = ctrl.expectOne(r => r.url === BASE);
      expect(req.request.params.keys().sort()).toEqual(['busca', 'categoriaId', 'localId', 'page', 'pageSize', 'status']);
      expect(req.request.params.get('localId')).toBe('7');
      req.flush({ items: [], page: 2, pageSize: 50, total: 0 });
    });

    it('incluirSublocais só vai na query quando é false (o padrão do servidor é true)', () => {
      service.listar({ localId: 7, incluirSublocais: true }).subscribe();
      expect(ctrl.expectOne(r => r.url === BASE).request.params.has('incluirSublocais')).toBeFalse();

      service.listar({ localId: 7, incluirSublocais: false }).subscribe();
      const req = ctrl.expectOne(r => r.url === BASE);
      expect(req.request.params.get('incluirSublocais')).toBe('false');
    });
  });

  it('por-plaqueta codifica a plaqueta na query string (pode conter "/")', () => {
    service.porPlaqueta('NB/0001 A').subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/por-plaqueta`);
    expect(req.request.params.get('plaqueta')).toBe('NB/0001 A');
    expect(req.request.urlWithParams).toContain('plaqueta=NB/0001%20A');
  });

  it('CRUD usa os verbos e caminhos da API', () => {
    service.obter(5).subscribe();
    expect(ctrl.expectOne(`${BASE}/5`).request.method).toBe('GET');

    service.criar({ plaqueta: 'A', descricao: 'd', categoriaId: 1, localId: 1, dataAquisicao: '2024-01-01', valorAquisicao: 1 }).subscribe();
    expect(ctrl.expectOne(BASE).request.method).toBe('POST');

    service.atualizar(5, { plaqueta: 'A', descricao: 'd', categoriaId: 1, localId: 1, dataAquisicao: '2024-01-01', valorAquisicao: 1 }).subscribe();
    expect(ctrl.expectOne(`${BASE}/5`).request.method).toBe('PUT');

    service.excluir(5).subscribe();
    expect(ctrl.expectOne(`${BASE}/5`).request.method).toBe('DELETE');
  });

  describe('exportar', () => {
    it('baixa como blob com os filtros, sem page/pageSize, e lê o nome do arquivo', () => {
      let arquivo: { blob: Blob; nome: string } | undefined;
      service.exportar({ busca: 'nb', localId: 7, incluirSublocais: false, page: 3, pageSize: 100 }).subscribe(a => arquivo = a);
      const req = ctrl.expectOne(r => r.url === `${BASE}/exportar`);
      expect(req.request.responseType).toBe('blob');
      expect(req.request.params.has('page')).toBeFalse();
      expect(req.request.params.has('pageSize')).toBeFalse();
      expect(req.request.params.get('incluirSublocais')).toBe('false');
      req.flush(new Blob(['a;b']), { headers: { 'Content-Disposition': 'attachment; filename="bens-2026.csv"' } });
      expect(arquivo?.nome).toBe('bens-2026.csv');
      expect(arquivo?.blob.size).toBe(3);
    });

    it('usa bens.csv quando o servidor não informa o nome', () => {
      let nome = '';
      service.exportar().subscribe(a => nome = a.nome);
      ctrl.expectOne(r => r.url === `${BASE}/exportar`).flush(new Blob(['x']));
      expect(nome).toBe('bens.csv');
    });

    it('o 400 (corpo Blob) vira erro legível com a mensagem do servidor', async () => {
      const msg = 'A exportação é limitada a 20000 bens e o filtro retornou 25000. Refine os filtros.';
      const erro = new Promise<HttpErrorResponse>(resolve => service.exportar().subscribe({ error: resolve }));
      ctrl.expectOne(r => r.url === `${BASE}/exportar`).flush(
        new Blob([JSON.stringify({ error: msg })], { type: 'application/json' }), { status: 400, statusText: 'Bad Request' });
      const e = await erro;
      expect(e.status).toBe(400);
      expect(lerErroApi(e, 'x').mensagem).toBe(msg);
    });
  });
});
