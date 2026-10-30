import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HistoricoComponent } from './historico.component';
import { fimDoDiaLocalISO, inicioDoDiaLocalISO } from '../../../core/utils/periodo';

const URL = '/api/v1/empresa-ativa/configuracoes/historico';
const evento = (id: number) => ({ id, area: 'fiscal', acao: 'atualizou', campo: 'cnae', detalhe: null, atorUsuarioId: 'u', atorNome: 'Fulano', criadoEm: '2026-10-27T12:00:00Z' });
const vazio = { items: [], page: 1, pageSize: 50, total: 0 };

describe('HistoricoComponent', () => {
  let fixture: ComponentFixture<HistoricoComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HistoricoComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HistoricoComponent);
  });
  afterEach(() => ctrl.verify());

  it('lista eventos paginados (pageSize <= 100)', () => {
    fixture.detectChanges();
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(Number(req.request.params.get('pageSize'))).toBeLessThanOrEqual(100);
    expect(req.request.params.has('area')).toBeFalse();
    req.flush({ items: [evento(1), evento(2)], page: 1, pageSize: 50, total: 120 });
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
    expect(el().textContent).toContain('Fulano');
    expect(el().textContent).toContain('Fiscal');
    expect(el().textContent).toContain('Página 1 de 3');
  });

  it('filtros de área e período usam o helper de periodo.ts', () => {
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === URL).flush(vazio);
    const c = fixture.componentInstance;
    c.area = 'logo'; c.inicio = '2026-10-01'; c.fim = '2026-10-27';
    c.filtrar();
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('area')).toBe('logo');
    expect(req.request.params.get('dataInicio')).toBe(inicioDoDiaLocalISO('2026-10-01')!);
    expect(req.request.params.get('dataFim')).toBe(fimDoDiaLocalISO('2026-10-27')!);
    req.flush(vazio);
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhuma alteração registrada.');
  });

  it('intervalo invertido avisa e não chama a API', () => {
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === URL).flush(vazio);
    const c = fixture.componentInstance;
    c.inicio = '2026-10-27'; c.fim = '2026-10-01';
    c.filtrar();
    fixture.detectChanges();
    expect(el().textContent).toContain('A data fim é anterior');
  });

  it('erro do servidor é exibido como veio', () => {
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === URL).flush({ error: 'Apenas administradores.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')!.textContent).toContain('Apenas administradores.');
  });
});
