import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ImobOsDetalheComponent } from './imob-os-detalhe.component';
import { ImobOrdemServicoService } from '../../../core/services/imob-ordem-servico.service';
import { ImobOs, formatarNumeroOs } from '../../../core/models/imob-ordem-servico.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const URL_OS = '/api/v1/imobilizado/ordens-servico/12';

const os = (extra: Partial<ImobOs> = {}): ImobOs => ({
  id: 12, numero: 5, tipo: 'baixa', status: 'pendente', solicitanteId: 'u1', solicitanteNome: 'Maria',
  totalItens: 1, criadoEm: '2026-10-23T12:00:00Z', atualizadoEm: '2026-10-23T12:00:00Z', justificativa: 'Sem uso',
  motivoBaixa: 'descarte',
  itens: [{ id: 1, bemId: 10, plaqueta: 'NB-1', descricao: 'Notebook', statusOrigem: 'ativo', localOrigemId: 1, localOrigemNome: 'Matriz' }],
  eventos: [{ id: 1, evento: 'criada', usuarioId: 'u1', usuarioNome: 'Maria', criadoEm: '2026-10-23T12:00:00Z' }],
  ...extra
});

describe('formatarNumeroOs', () => {
  it('formata com zeros à esquerda', () => {
    expect(formatarNumeroOs(5)).toBe('OS-000005');
    expect(formatarNumeroOs(123)).toBe('OS-000123');
  });
});

describe('ImobOsDetalheComponent', () => {
  let ctrl: HttpTestingController;

  function montar(role: 'admin' | 'operador' | 'leitura', ordem: ImobOs) {
    TestBed.configureTestingModule({
      imports: [ImobOsDetalheComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '12' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImobOsDetalheComponent);
    fixture.detectChanges();
    ctrl.expectOne(URL_OS).flush(ordem);
    fixture.detectChanges();
    const botoes = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .map(b => (b.textContent ?? '').trim());
    return { fixture, comp: fixture.componentInstance, botoes };
  }

  afterEach(() => ctrl.verify());

  it('admin vê Aprovar, Rejeitar e Cancelar na OS pendente', () => {
    const { botoes } = montar('admin', os());
    expect(botoes()).toEqual(jasmine.arrayContaining(['Aprovar', 'Rejeitar', 'Cancelar']));
  });

  it('operador que não é o solicitante não vê ações', () => {
    const { botoes } = montar('operador', os());
    expect(botoes().filter(b => b)).toEqual([]);
  });

  it('leitura não vê ações', () => {
    const { botoes } = montar('leitura', os());
    expect(botoes().filter(b => b)).toEqual([]);
  });

  it('manutenção aprovada: operador conclui, só admin cancela', () => {
    const manut = os({ tipo: 'manutencao', status: 'aprovada' });
    const operador = montar('operador', manut);
    expect(operador.botoes()).toContain('Concluir manutenção');
    expect(operador.botoes()).not.toContain('Cancelar');
    expect(operador.comp.podeCancelar()).toBeFalse();
  });

  it('manutenção aprovada: admin vê Concluir e Cancelar, sem Aprovar', () => {
    const { botoes } = montar('admin', os({ tipo: 'manutencao', status: 'aprovada' }));
    expect(botoes()).toEqual(jasmine.arrayContaining(['Concluir manutenção', 'Cancelar']));
    expect(botoes()).not.toContain('Aprovar');
  });

  it('OS concluída é somente leitura', () => {
    const { botoes } = montar('admin', os({ status: 'concluida' }));
    expect(botoes().filter(b => b)).toEqual([]);
  });

  it('rejeitar exige comentário e envia ao servidor', () => {
    const { comp, fixture } = montar('admin', os());
    comp.abrirAcao('rejeitar');
    comp.confirmar();
    expect(comp.erroAcao()).toContain('motivo');
    comp.comentario.setValue('Sem verba');
    comp.confirmar();
    const req = ctrl.expectOne(`${URL_OS}/rejeitar`);
    expect(req.request.body).toEqual({ comentario: 'Sem verba' });
    req.flush(os({ status: 'rejeitada' }));
    fixture.detectChanges();
    expect(comp.os()?.status).toBe('rejeitada');
    expect(comp.acao()).toBeNull();
  });

  it('erro 400 ao aprovar mostra a mensagem e recarrega a OS', () => {
    const { comp } = montar('admin', os());
    comp.abrirAcao('aprovar');
    comp.confirmar();
    ctrl.expectOne(`${URL_OS}/aprovar`).flush({ error: 'Só é possível aprovar OS pendentes (status atual: concluida).' }, { status: 400, statusText: 'Bad Request' });
    expect(comp.erroAcao()).toContain('status atual');
    ctrl.expectOne(URL_OS).flush(os({ status: 'concluida' }));
    expect(comp.os()?.status).toBe('concluida');
  });
});

describe('ImobOrdemServicoService', () => {
  it('conclui com custo real e comentário', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(ImobOrdemServicoService).concluir(12, 320.75, 'Trocada a fonte').subscribe();
    const req = ctrl.expectOne(`${URL_OS}/concluir`);
    expect(req.request.body).toEqual({ custoReal: 320.75, comentario: 'Trocada a fonte' });
    req.flush({});
    ctrl.verify();
  });

  it('lista com filtros definidos apenas', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(ImobOrdemServicoService).listar({ bemId: 4, status: 'pendente' }).subscribe();
    const req = ctrl.expectOne(r => r.url === '/api/v1/imobilizado/ordens-servico');
    expect(req.request.params.get('bemId')).toBe('4');
    expect(req.request.params.get('status')).toBe('pendente');
    expect(req.request.params.has('tipo')).toBeFalse();
    req.flush({ items: [], page: 1, pageSize: 50, total: 0 });
    ctrl.verify();
  });
});
