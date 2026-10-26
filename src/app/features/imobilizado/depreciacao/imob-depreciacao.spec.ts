import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { ImobDepreciacaoFechamentoComponent } from './imob-depreciacao-fechamento.component';
import { ImobDepreciacaoPainelComponent } from './imob-depreciacao-painel.component';
import { ListaPeriodos, PainelDepreciacao, PeriodoFechado, formatarMes } from '../../../core/models/imob-depreciacao.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/depreciacao';

const periodo = (mes: string, revisao = 1): PeriodoFechado => ({
  competencia: `${mes}-01`, mes, revisao, metodologiaVersao: '1.0', totalBens: 2, totalDepreciacao: 100, totalAcumulada: 500,
  totalValorContabil: 900, fechadoPorNome: 'Maria', fechadoEm: '2026-10-02T13:10:00Z'
});

const lista = (extra: Partial<ListaPeriodos> = {}): ListaPeriodos => ({
  periodos: { items: [periodo('2026-08')], page: 1, pageSize: 100, total: 1 },
  proximaCompetenciaAFechar: '2026-09-01', ultimaCompetenciaFechavel: '2026-09-01', mesesEncerradosSemFechamento: 1, ...extra
});

describe('formatarMes', () => {
  it('converte competência em MM/yyyy sem Date', () => {
    expect(formatarMes('2026-09-01')).toBe('09/2026');
    expect(formatarMes('2026-09')).toBe('09/2026');
    expect(formatarMes(null)).toBe('—');
  });
});

describe('ImobDepreciacaoService', () => {
  let ctrl: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('reabrir envia o motivo', () => {
    TestBed.inject(ImobDepreciacaoService).reabrir('2026-08', 'Valor errado').subscribe();
    const req = ctrl.expectOne(`${BASE}/periodos/2026-08/reabrir`);
    expect(req.request.body).toEqual({ motivo: 'Valor errado' });
    req.flush({});
  });

  it('comparar envia de/para', () => {
    TestBed.inject(ImobDepreciacaoService).comparar('2026-08', 1, 2, { page: 1 }).subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/periodos/2026-08/comparar`);
    expect(req.request.params.get('de')).toBe('1');
    expect(req.request.params.get('para')).toBe('2');
    req.flush({});
  });

  it('baixa o razão como blob com o formato e usa o nome do servidor', () => {
    let nome = '';
    TestBed.inject(ImobDepreciacaoService).baixarRazao({ competencia: '2026-03', agrupar: 'bem' }, 'csv').subscribe(a => nome = a.nome);
    const req = ctrl.expectOne(r => r.url === `${BASE}/relatorios/razao`);
    expect(req.request.params.get('formato')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="razao-2026-03-rev1-bem.csv"' } });
    expect(nome).toBe('razao-2026-03-rev1-bem.csv');
  });

  it('valor contábil exportado não envia paginação', () => {
    TestBed.inject(ImobDepreciacaoService).baixarValorContabil({ em: '2026-03-31', page: 2, pageSize: 50 }, 'pdf').subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/relatorios/valor-contabil`);
    expect(req.request.params.has('page')).toBeFalse();
    expect(req.request.params.get('em')).toBe('2026-03-31');
    req.flush(new Blob(['x']));
  });
});

describe('ImobDepreciacaoFechamentoComponent', () => {
  let ctrl: HttpTestingController;

  function montar(role: 'admin' | 'operador' | 'leitura', dados = lista()) {
    TestBed.configureTestingModule({
      imports: [ImobDepreciacaoFechamentoComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImobDepreciacaoFechamentoComponent);
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === `${BASE}/periodos`).flush(dados);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance, texto: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  }

  afterEach(() => ctrl.verify());

  it('admin vê "Fechar" do próximo mês e "Reabrir" só no último período', () => {
    const { texto } = montar('admin');
    expect(texto()).toContain('Fechar 09/2026');
    expect(texto()).toContain('Reabrir');
    expect(texto()).toContain('Há 1 mês(es) encerrado(s) sem fechamento');
  });

  it('leitura só consulta: sem Fechar nem Reabrir', () => {
    const { texto } = montar('leitura');
    expect(texto()).not.toContain('Fechar 09/2026');
    expect(texto()).not.toContain('Reabrir');
    expect(texto()).toContain('Histórico');
  });

  it('sem período fechado o admin escolhe o mês inicial', () => {
    const { fixture, comp } = montar('admin', lista({
      periodos: { items: [], page: 1, pageSize: 100, total: 0 }, proximaCompetenciaAFechar: null
    }));
    expect((fixture.nativeElement as HTMLElement).querySelector('#mesInicial')).not.toBeNull();
    comp.mesInicial.setValue('2025-03');
    comp.abrirPreviaInicial();
    const req = ctrl.expectOne(r => r.url === `${BASE}/previa`);
    expect(req.request.params.get('competencia')).toBe('2025-03');
    req.flush({ competencia: '2025-03-01', mes: '2025-03', fechavel: false, motivoNaoFechavel: 'x', totais: {}, avisos: [], linhas: { items: [], page: 1, pageSize: 20, total: 0 } });
  });

  it('reabrir exige motivo', () => {
    const { comp } = montar('admin');
    comp.abrirReabertura(comp.periodos()[0]);
    comp.confirmarReabertura();
    expect(comp.erroReabertura()).toContain('motivo');
    comp.motivo.setValue('Digitado errado');
    comp.confirmarReabertura();
    const req = ctrl.expectOne(`${BASE}/periodos/2026-08/reabrir`);
    expect(req.request.body).toEqual({ motivo: 'Digitado errado' });
    req.flush({ competencia: '2026-08-01', mes: '2026-08', fechado: false, eventos: [] });
    ctrl.expectOne(r => r.url === `${BASE}/periodos`).flush(lista());
  });
});

describe('ImobDepreciacaoPainelComponent', () => {
  it('mapeia o destino dos alertas para rotas do front', () => {
    TestBed.configureTestingModule({
      imports: [ImobDepreciacaoPainelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ImobDepreciacaoPainelComponent);
    fixture.detectChanges();
    const painel: PainelDepreciacao = {
      em: '2026-10-23', metodologiaVersao: '1.0',
      totais: { nome: 'TOTAL', quantidade: 1, valorAquisicao: 1000, acumulada: 100, valorContabil: 900 },
      porCategoria: [], porStatus: [], ultimosFechamentos: [], proximaCompetenciaAFechar: null, mesesEncerradosSemFechamento: 0,
      alertas: [
        { codigo: 'dados_incompletos', severidade: 'aviso', mensagem: '3 bens sem dados.', quantidade: 3, destino: 'bens-dados-pendentes' },
        { codigo: 'x', severidade: 'info', mensagem: 'Destino desconhecido.', quantidade: 1, destino: 'nao-existe' }
      ]
    };
    ctrl.expectOne(`${BASE}/dashboard`).flush(painel);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.destino(painel.alertas[0])?.queryParams).toEqual({ dadosCompletos: 'false' });
    expect(comp.destino(painel.alertas[1])).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 bens sem dados.');
    ctrl.verify();
  });
});
