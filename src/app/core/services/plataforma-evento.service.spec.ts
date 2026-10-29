import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaEventoService } from './plataforma-evento.service';

const BASE = '/api/v1/plataforma';

describe('PlataformaEventoService', () => {
  let service: PlataformaEventoService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaEventoService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('envia só filtros definidos e limita pageSize a 100', () => {
    service.eventos({ empresaId: 3, acao: '', atorId: 'g1', pageSize: 500, page: 2 }).subscribe();
    const r = ctrl.expectOne(x => x.url === `${BASE}/eventos`);
    expect(r.request.params.get('empresaId')).toBe('3');
    expect(r.request.params.get('atorId')).toBe('g1');
    expect(r.request.params.has('acao')).toBeFalse();
    expect(r.request.params.get('pageSize')).toBe('100');
    expect(r.request.params.get('page')).toBe('2');
  });

  it('consulta logs do sistema com nível e período', () => {
    service.logs({ nivel: 'Error', dataInicio: '2026-10-01', page: 1 }).subscribe();
    const r = ctrl.expectOne(x => x.url === `${BASE}/logs`);
    expect(r.request.params.get('nivel')).toBe('Error');
    expect(r.request.params.get('dataInicio')).toBe('2026-10-01');
    expect(r.request.params.get('pageSize')).toBe('50');
  });
});
