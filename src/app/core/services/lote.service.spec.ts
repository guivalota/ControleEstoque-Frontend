import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoteService } from './lote.service';

describe('LoteService', () => {
  let ctrl: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('lista com parâmetros PascalCase só quando definidos', () => {
    let total = 0;
    TestBed.inject(LoteService).getAll({ ProdutoId: 3, Vencidos: true, Page: 2, PageSize: 50 }).subscribe(r => total = r.total);
    const req = ctrl.expectOne(r => r.url === '/api/v1/lotes');
    expect(req.request.params.get('ProdutoId')).toBe('3');
    expect(req.request.params.get('Vencidos')).toBe('true');
    expect(req.request.params.has('Vencendo')).toBeFalse();
    req.flush({ items: [], page: 2, pageSize: 50, total: 7 });
    expect(total).toBe(7);
  });

  it('busca os lotes vencendo em N dias', () => {
    TestBed.inject(LoteService).getVencendo(15).subscribe();
    const req = ctrl.expectOne(r => r.url === '/api/v1/lotes/vencendo');
    expect(req.request.params.get('dias')).toBe('15');
    req.flush([]);
  });

  it('cria e exclui', () => {
    const svc = TestBed.inject(LoteService);
    svc.create({ produtoId: 1, numeroLote: 'L1', quantidadeInicial: 10 }).subscribe();
    ctrl.expectOne('/api/v1/lotes').flush({});
    svc.delete(5).subscribe();
    const del = ctrl.expectOne('/api/v1/lotes/5');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
