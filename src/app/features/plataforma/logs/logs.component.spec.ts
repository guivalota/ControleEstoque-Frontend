import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PlataformaLogsComponent } from './logs.component';

const EVENTOS = '/api/v1/plataforma/eventos';
const AUDIT = '/api/v1/audit-logs';
const LOGS = '/api/v1/plataforma/logs';

describe('PlataformaLogsComponent', () => {
  let ctrl: HttpTestingController;
  let fixture: ComponentFixture<PlataformaLogsComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  function criar(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [PlataformaLogsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaLogsComponent);
    fixture.detectChanges();
  }
  const abrirAba = (rotulo: string) => {
    const btn = Array.from(el().querySelectorAll('button.nav-link')).find(b => b.textContent?.includes(rotulo)) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
  };

  afterEach(() => ctrl.verify());

  it('abre na trilha e aplica filtros com pageSize 50 (máx. 100)', () => {
    criar();
    const r = ctrl.expectOne(x => x.url === EVENTOS);
    expect(r.request.params.get('pageSize')).toBe('50');
    expect(r.request.params.has('empresaId')).toBeFalse();
    r.flush({ items: [{ id: 1, acao: 'empresa.criar', atorNome: 'Root', empresaNome: 'Acme', alvoNome: '', criadoEm: '2026-10-22T14:03:11Z' }], page: 1, pageSize: 50, total: 1 });
    fixture.detectChanges();
    expect(el().textContent).toContain('empresa.criar');

    const trilha = fixture.debugElement.query(x => x.name === 'app-logs-trilha').componentInstance;
    trilha.empresaId = 9;
    trilha.atorId = '  3f2504e0-4f89-11d3-9a0c-0305e82c3301 ';
    trilha.acao = 'plano';
    trilha.dataInicio = '2026-10-01';
    trilha.dataFim = '2026-10-31';
    trilha.carregar(1);
    const f = ctrl.expectOne(x => x.url === EVENTOS);
    expect(f.request.params.get('empresaId')).toBe('9');
    expect(f.request.params.get('atorId')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    expect(f.request.params.get('acao')).toBe('plano');
    expect(f.request.params.get('dataInicio')).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(f.request.params.get('dataFim')).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).toISOString());
    f.flush({ items: [], page: 1, pageSize: 50, total: 0 });
  });

  it('pré-filtra a trilha por ?empresaId=', () => {
    criar({ empresaId: '12' });
    const r = ctrl.expectOne(x => x.url === EVENTOS);
    expect(r.request.params.get('empresaId')).toBe('12');
    r.flush({ items: [], page: 1, pageSize: 50, total: 0 });
  });

  it('pagina a trilha', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 120 });
    const trilha = fixture.debugElement.query(x => x.name === 'app-logs-trilha').componentInstance;
    expect(trilha.temProxima()).toBeTrue();
    trilha.carregar(2);
    const r = ctrl.expectOne(x => x.url === EVENTOS);
    expect(r.request.params.get('page')).toBe('2');
    r.flush({ items: [], page: 2, pageSize: 50, total: 120 });
  });

  it('aba de auditoria usa v1/audit-logs com usuarioId UUID', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    abrirAba('Auditoria');
    ctrl.expectOne(x => x.url === AUDIT).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    const aud = fixture.debugElement.query(x => x.name === 'app-logs-auditoria').componentInstance;
    aud.usuarioId = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    aud.method = 'POST';
    aud.carregar(1);
    const r = ctrl.expectOne(x => x.url === AUDIT);
    expect(r.request.params.get('usuarioId')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    expect(r.request.params.get('method')).toBe('POST');
    r.flush({ items: [{ id: 1, usuarioId: 'u', usuarioNome: 'Ana', endpoint: '/v1/x', method: 'POST', recursoId: null, ip: '1.1.1.1', criadoEm: '2026-10-22T14:03:11Z' }], page: 1, pageSize: 50, total: 1 });
    fixture.detectChanges();
    expect(el().textContent).toContain('/v1/x');
  });

  it('trilha: ator com UUID inválido mostra mensagem inline e não chama a API', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [{ id: 1, acao: 'criou_empresa', atorNome: 'Root', empresaNome: 'Acme', alvoNome: '', criadoEm: '2026-10-22T14:03:11Z' }], page: 1, pageSize: 50, total: 1 });
    fixture.detectChanges();
    const trilha = fixture.debugElement.query(x => x.name === 'app-logs-trilha').componentInstance;
    trilha.atorId = 'xyz';
    trilha.carregar(1);
    ctrl.expectNone(x => x.url === EVENTOS);
    fixture.detectChanges();
    expect(el().querySelector('#trAtor')!.classList).toContain('is-invalid');
    expect(el().textContent).toContain('UUID válido');
  });

  it('trilha: 400 no formato ASP.NET mostra a mensagem do campo e limpa a lista antiga', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [{ id: 1, acao: 'criou_empresa', atorNome: 'Root', empresaNome: 'Acme', alvoNome: '', criadoEm: '2026-10-22T14:03:11Z' }], page: 1, pageSize: 50, total: 1 });
    const trilha = fixture.debugElement.query(x => x.name === 'app-logs-trilha').componentInstance;
    trilha.carregar(1);
    ctrl.expectOne(x => x.url === EVENTOS).flush({ title: 'One or more validation errors occurred.', errors: { atorId: ['O valor informado é inválido.'] } }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('O valor informado é inválido.');
    expect(el().querySelector('table')).toBeNull();
    expect(trilha.eventos().length).toBe(0);
  });

  it('trilha: filtro Ação é uma lista com "Todas" e as ações conhecidas', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    const sel = el().querySelector('#trAcao') as HTMLSelectElement;
    expect(sel.tagName).toBe('SELECT');
    const valores = Array.from(sel.options).map(o => o.value);
    expect(valores[0]).toBe('');
    expect(sel.options[0].textContent).toContain('Todas');
    expect(valores).toContain('desativou_empresa');
    expect(valores).toContain('reativou_empresa');
  });

  it('auditoria: usuário com UUID inválido não chama a API e mostra mensagem inline', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    abrirAba('Auditoria');
    ctrl.expectOne(x => x.url === AUDIT).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    const aud = fixture.debugElement.query(x => x.name === 'app-logs-auditoria').componentInstance;
    aud.usuarioId = 'não-é-uuid';
    aud.carregar(1);
    ctrl.expectNone(x => x.url === AUDIT);
    fixture.detectChanges();
    expect(el().querySelector('#auUsuario')!.classList).toContain('is-invalid');
    expect(el().textContent).toContain('UUID válido');
  });

  it('auditoria: 400 sem mensagem textual usa os erros de campo ou o texto padrão', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    abrirAba('Auditoria');
    ctrl.expectOne(x => x.url === AUDIT).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    const aud = fixture.debugElement.query(x => x.name === 'app-logs-auditoria').componentInstance;
    aud.carregar(1);
    ctrl.expectOne(x => x.url === AUDIT).flush({ errors: { usuarioId: ['Valor inválido.'] } }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Valor inválido.');
    aud.carregar(1);
    ctrl.expectOne(x => x.url === AUDIT).flush(null, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Erro ao carregar a auditoria de acesso.');
  });

  it('aba de logs do sistema lista os itens', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    abrirAba('Logs do sistema');
    const r = ctrl.expectOne(x => x.url === LOGS);
    r.flush({ items: [{ id: 1, timestamp: '2026-10-22T14:03:11Z', nivel: 'Error', mensagem: 'Falha X', origem: 'Api' }], total: 1, page: 1, pageSize: 50 });
    fixture.detectChanges();
    expect(el().textContent).toContain('Falha X');
    expect(el().textContent).toContain('Error');
  });

  it('avisa e não consulta quando a data fim é anterior à início (PEND-16)', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    const trilha = fixture.debugElement.query(x => x.name === 'app-logs-trilha').componentInstance;
    trilha.dataInicio = '2026-10-27';
    trilha.dataFim = '2026-10-26';
    fixture.detectChanges();
    expect(el().textContent).toContain('A data fim é anterior à data início');
    trilha.carregar(1);
    ctrl.expectNone(x => x.url === EVENTOS);
  });

  it('mostra o erro do servidor (ex.: nível inválido)', () => {
    criar();
    ctrl.expectOne(x => x.url === EVENTOS).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    abrirAba('Logs do sistema');
    ctrl.expectOne(x => x.url === LOGS).flush({ error: 'Nível inválido.' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Nível inválido.');
  });
});
