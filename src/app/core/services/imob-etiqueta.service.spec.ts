import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobEtiquetaService } from './imob-etiqueta.service';

describe('ImobEtiquetaService', () => {
  let service: ImobEtiquetaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobEtiquetaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista os modelos', () => {
    service.modelos().subscribe(m => expect(m.length).toBe(1));
    http.expectOne(r => r.url.endsWith('/v1/imobilizado/etiquetas/modelos')).flush([
      { codigo: 'a4-21', descricao: 'x', etiquetaLarguraMm: 63.5, etiquetaAlturaMm: 38.1, etiquetasPorPagina: 21 }
    ]);
  });

  it('com ids repete o parametro e ignora os filtros', () => {
    service.gerar({ ids: [1, 2], modelo: 'a4-21', bordas: true, filtro: { busca: 'x' } }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/imobilizado/etiquetas'));
    expect(req.request.params.getAll('ids')).toEqual(['1', '2']);
    expect(req.request.params.get('modelo')).toBe('a4-21');
    expect(req.request.params.get('bordas')).toBe('true');
    expect(req.request.params.has('busca')).toBeFalse();
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
  });

  it('sem ids envia o filtro, sem paginacao nem bordas falsas', () => {
    service.gerar({
      modelo: 'rolo-50x30', bordas: false,
      filtro: { busca: 'mesa', localId: 3, incluirSublocais: false, dadosCompletos: false, page: 2, pageSize: 50 }
    }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/imobilizado/etiquetas'));
    const p = req.request.params;
    expect(p.get('busca')).toBe('mesa');
    expect(p.get('localId')).toBe('3');
    expect(p.get('incluirSublocais')).toBe('false');
    expect(p.get('dadosCompletos')).toBe('false');
    expect(p.has('page')).toBeFalse();
    expect(p.has('pageSize')).toBeFalse();
    expect(p.has('bordas')).toBeFalse();
    req.flush(new Blob());
  });

  it('reconstrói o erro 400 vindo como Blob', done => {
    service.gerar({ ids: [9], modelo: 'a4-21', bordas: false }).subscribe({
      error: err => { expect(err.error.error).toContain('não encontrado'); done(); }
    });
    http.expectOne(r => r.url.endsWith('/v1/imobilizado/etiquetas'))
      .flush(new Blob([JSON.stringify({ error: 'Bem(ns) não encontrado(s): 9.' })]), { status: 400, statusText: 'Bad Request' });
  });
});
