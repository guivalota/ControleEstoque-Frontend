import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { RelatoriosProducaoComponent } from './relatorios-producao.component';
import { ProducaoInicioComponent } from '../producao-inicio.component';
import { CustoOrdens, DashboardProducao, ProducaoPeriodo } from '../../../core/models/relatorio-producao.model';

const base = `${environment.apiUrl}/v1/producao`;

const custo: CustoOrdens = {
  de: '2026-10-05', ate: '2026-11-03', totalPadrao: 160, totalReal: 170, totalDiferenca: 10, ordensSemCustoPadrao: 1,
  ordens: [{
    ordemId: 9, numero: 4, produtoSku: 'CAM', produtoNome: 'Camiseta', concluidaEm: '2026-11-02T12:00:00Z', pecas: 10, custoPadrao: 80,
    insumos: 60, maoDeObra: 20, custosIndiretos: 10, faccao: 0, custoReal: 90, diferenca: 10, diferencaPercentual: 12.5
  }]
};

const producao: ProducaoPeriodo = {
  de: '2026-10-05', ate: '2026-11-03', totalPecas: 38,
  produtos: [{ produtoId: 21, produtoSku: 'CAM-P', produtoNome: 'Camiseta P', quantidade: 38, apontamentosComSobreproducao: 1 }],
  perdaDeTecido: [{ materialId: 10, materialNome: 'Malha', unidadeCodigo: 'm', cortes: 2, consumido: 72, consumoTeorico: 60, consumoPrevisto: 66,
    perdaRealPercentual: 20, perdaPrevistaPercentual: 10, aproveitamentoPercentual: 83.33 }],
  ordensAtrasadas: [{ ordemId: 7, numero: 2, produtoNome: 'Saia', status: 'liberada', prazo: '2026-10-30', diasDeAtraso: 4 }]
};

describe('RelatoriosProducaoComponent', () => {
  let http: HttpTestingController;

  function criar() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RelatoriosProducaoComponent);
    fixture.detectChanges();
    http.expectOne(r => r.url === `${base}/relatorios/custo-ordens`).flush(custo);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra o custo real × padrão por ordem com a diferença e o aviso de ordens sem padrão', () => {
    const texto = (criar().nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Camiseta');
    expect(texto).toMatch(/R\$\s*80,00/);
    expect(texto).toMatch(/R\$\s*90,00/);
    expect(texto).toMatch(/R\$\s*10,00 \(12,5%\)/);
    expect(texto).toContain('1 ordem(ns) sem custo padrão');
  });

  it('consultar envia o período', () => {
    const fixture = criar();
    fixture.componentInstance.de = '2026-10-01';
    fixture.componentInstance.ate = '2026-10-31';

    fixture.componentInstance.carregar();

    const req = http.expectOne(r => r.url === `${base}/relatorios/custo-ordens`);
    expect(req.request.params.get('de')).toBe('2026-10-01');
    expect(req.request.params.get('ate')).toBe('2026-10-31');
    req.flush(custo);
  });

  it('a aba de produção mostra peças, perda de tecido real × prevista e ordens atrasadas', () => {
    const fixture = criar();

    fixture.componentInstance.trocar('producao');
    http.expectOne(r => r.url === `${base}/relatorios/producao`).flush(producao);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Camiseta P');
    expect(texto).toContain('Perda de tecido');
    expect(texto).toContain('20%');
    expect(texto).toContain('83,33%');
    expect(texto).toContain('4 dia(s) de atraso');
  });

  it('exportar pede o arquivo com o formato e o período da tela', () => {
    const fixture = criar();
    fixture.componentInstance.de = '2026-10-01';

    fixture.componentInstance.exportar('pdf');

    const req = http.expectOne(r => r.url === `${base}/relatorios/custo-ordens` && r.params.get('formato') === 'pdf');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('de')).toBe('2026-10-01');
    req.flush(new Blob(['%PDF-'], { type: 'application/pdf' }));
  });

  it('mostra a recusa do servidor (ex.: período longo demais)', () => {
    const fixture = criar();

    fixture.componentInstance.carregar();
    http.expectOne(r => r.url === `${base}/relatorios/custo-ordens`).flush({ error: 'O período pode ter no máximo 366 dias.' }, { status: 400, statusText: 'Bad Request' });

    expect(fixture.componentInstance.erro()).toContain('366');
    expect(fixture.componentInstance.carregando()).toBeFalse();
  });
});

describe('ProducaoInicioComponent (painel)', () => {
  let http: HttpTestingController;

  const painel: DashboardProducao = {
    ordensPorEstado: [{ status: 'planejada', quantidade: 2 }, { status: 'liberada', quantidade: 1 }, { status: 'em_producao', quantidade: 3 },
      { status: 'concluida', quantidade: 5 }, { status: 'cancelada', quantidade: 0 }],
    ordensAtrasadas: 2, maisAtrasadas: [{ ordemId: 7, numero: 2, produtoNome: 'Saia', status: 'liberada', prazo: '2026-10-30', diasDeAtraso: 4 }],
    materiaisAComprar: 1, materiaisPrioritarios: [{ materialId: 10, materialNome: 'Malha', unidadeCodigo: 'm', aComprar: 200, atrasada: true }],
    remessasAbertas: 2, remessasAtrasadas: 1, pecasEmPoderDeOficinas: 40
  };

  function criar() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProducaoInicioComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/dashboard`).flush(painel);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra as ordens por estado, as atrasadas, os materiais a comprar e a terceirização', () => {
    const texto = (criar().nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Em produção');
    expect(texto).toContain('Ordens atrasadas: 2');
    expect(texto).toContain('4 dia(s)');
    expect(texto).toContain('Materiais a comprar: 1');
    expect(texto).toContain('comprar já');
    expect(texto).toContain('2 remessa(s) em aberto');
    expect(texto).toContain('1 remessa(s) atrasada(s)');
  });

  it('erro do servidor aparece em vez do painel', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProducaoInicioComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/dashboard`).flush({ error: 'Sem acesso.' }, { status: 403, statusText: 'Forbidden' });

    expect(fixture.componentInstance.erro()).not.toBe('');
  });
});
