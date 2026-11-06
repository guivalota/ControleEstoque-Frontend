import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceiroRelatoriosService } from '../../../core/services/financeiro-relatorios.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { AgruparFluxo, FluxoCaixa, FluxoPeriodo } from '../../../core/models/financeiro-relatorios.model';
import { ContaFin } from '../../../core/models/financeiro-cadastros.model';
import { mesAtual, ultimoDiaDoMes } from '../../../core/utils/financeiro-datas';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

type Medida = 'realizado' | 'previsto';

const L = 720; // largura do desenho
const A = 240; // altura do desenho
const ML = 70; // margem para os valores do eixo
const MB = 26; // margem para as datas
const MT = 10;

/** Valor arredondado "bonito" para o topo do eixo (1, 2, 5 × 10^n). */
function topoDoEixo(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/**
 * Fluxo de caixa (US-24-05): previsto (títulos em aberto por vencimento) × realizado (baixas) e o saldo das contas. Entradas e
 * saídas no mesmo eixo (barras agrupadas, uma medida por vez); o saldo em outro gráfico, com a linha tracejada para o projetado.
 * Sempre há legenda, dica ao passar o mouse e a mesma informação em tabela.
 */
@Component({
  selector: 'app-fluxo-caixa',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host {
      --viz-entrada: #2a78d6; --viz-saida: #eb6834; --viz-grade: #d9d8d4; --viz-texto: #52514e; --viz-fundo: #fcfcfb;
    }
    :host-context([data-bs-theme='dark']) {
      --viz-entrada: #3987e5; --viz-saida: #d95926; --viz-grade: #3a3a38; --viz-texto: #c3c2b7; --viz-fundo: #1a1a19;
    }
    .viz { background: var(--viz-fundo); border-radius: .5rem; padding: .75rem; position: relative; }
    svg text { fill: var(--viz-texto); font-size: 11px; }
    .grade { stroke: var(--viz-grade); stroke-width: 1; }
    .barra-entrada { fill: var(--viz-entrada); }
    .barra-saida { fill: var(--viz-saida); }
    .linha-realizado { stroke: var(--viz-entrada); stroke-width: 2; fill: none; }
    .linha-projetado { stroke: var(--viz-entrada); stroke-width: 2; fill: none; stroke-dasharray: 6 4; }
    .ponto { fill: var(--viz-entrada); stroke: var(--viz-fundo); stroke-width: 2; }
    .alvo { fill: transparent; cursor: default; }
    .dica { position: absolute; z-index: 2; pointer-events: none; background: var(--viz-fundo); border: 1px solid var(--viz-grade);
            border-radius: .375rem; padding: .4rem .6rem; font-size: .8rem; box-shadow: 0 2px 6px rgba(0,0,0,.2); min-width: 11rem; }
    .chave { display: inline-block; width: .7rem; height: .7rem; border-radius: 2px; margin-right: .35rem; vertical-align: -1px; }
  `],
  template: `
    <h1 class="h4 mb-3">Fluxo de caixa</h1>

    <form class="row g-2 align-items-end mb-3" (submit)="$event.preventDefault(); carregar()">
      <div class="col-6 col-md-2"><label class="form-label small mb-1" for="fxDe">De</label><input id="fxDe" type="date" class="form-control form-control-sm" name="de" [(ngModel)]="de"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-1" for="fxAte">Até</label><input id="fxAte" type="date" class="form-control form-control-sm" name="ate" [(ngModel)]="ate"></div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fxAgr">Agrupar por</label>
        <select id="fxAgr" class="form-select form-select-sm" name="agr" [(ngModel)]="agrupar">
          <option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1" for="fxConta">Conta</label>
        <select id="fxConta" class="form-select form-select-sm" name="conta" [(ngModel)]="contaId">
          <option [ngValue]="null">Todas as contas</option>
          @for (c of contas(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
        </select>
      </div>
      <div class="col-12 col-md-3"><button type="submit" class="btn btn-primary btn-sm">Atualizar</button></div>
    </form>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (fluxo(); as f) {
      @if (!f.previstoIncluido) {
        <div class="alert alert-info py-2" role="status">Com uma conta só, o previsto não aparece: os títulos em aberto ainda não pertencem a nenhuma conta.</div>
      }

      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Entradas realizadas</small><strong>{{ moeda(f.totalEntradasRealizadas) }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Saídas realizadas</small><strong>{{ moeda(f.totalSaidasRealizadas) }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Entradas previstas</small><strong>{{ moeda(f.totalEntradasPrevistas) }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Saídas previstas</small><strong>{{ moeda(f.totalSaidasPrevistas) }}</strong></div></div>
      </div>

      <!-- ======================================================= entradas e saídas -->
      <section class="viz mb-3" aria-labelledby="tFluxo">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 id="tFluxo" class="h6 mb-0">Entradas e saídas</h2>
          <div class="btn-group btn-group-sm" role="group" aria-label="Medida do gráfico">
            <button type="button" class="btn btn-outline-primary" [class.active]="medida() === 'realizado'" (click)="medida.set('realizado')">Realizado</button>
            <button type="button" class="btn btn-outline-primary" [class.active]="medida() === 'previsto'" [disabled]="!f.previstoIncluido" (click)="medida.set('previsto')">Previsto</button>
          </div>
        </div>
        <div class="small mb-1" aria-hidden="true">
          <span class="me-3"><span class="chave" style="background: var(--viz-entrada)"></span>Entradas</span>
          <span><span class="chave" style="background: var(--viz-saida)"></span>Saídas</span>
        </div>
        <svg [attr.viewBox]="'0 0 ' + largura + ' ' + altura" class="w-100" role="img" [attr.aria-label]="'Entradas e saídas ' + medida() + ' por período; os mesmos valores estão na tabela abaixo.'">
          @for (t of eixoBarras().ticks; track t.valor) {
            <line class="grade" [attr.x1]="ml" [attr.x2]="largura" [attr.y1]="t.y" [attr.y2]="t.y"></line>
            <text [attr.x]="ml - 6" [attr.y]="t.y + 4" text-anchor="end">{{ curto(t.valor) }}</text>
          }
          @for (b of barras(); track b.i) {
            <rect class="barra-entrada" [attr.x]="b.xEntrada" [attr.y]="b.yEntrada" [attr.width]="b.largura" [attr.height]="b.hEntrada" rx="3"></rect>
            <rect class="barra-saida" [attr.x]="b.xSaida" [attr.y]="b.ySaida" [attr.width]="b.largura" [attr.height]="b.hSaida" rx="3"></rect>
            @if (b.rotulo) { <text [attr.x]="b.centro" [attr.y]="altura - 8" text-anchor="middle">{{ b.rotulo }}</text> }
            <rect class="alvo" [attr.x]="b.x" [attr.y]="mt" [attr.width]="b.larguraAlvo" [attr.height]="altura - mt - mb"
                  (mouseenter)="dica.set({ i: b.i, x: b.centro })" (mouseleave)="dica.set(null)" (focus)="dica.set({ i: b.i, x: b.centro })" (blur)="dica.set(null)" tabindex="0"
                  [attr.aria-label]="rotuloPeriodo(f.periodos[b.i]) + ': entradas ' + moeda(valor(f.periodos[b.i], 'entrada')) + ', saídas ' + moeda(valor(f.periodos[b.i], 'saida'))"></rect>
          }
        </svg>
        @if (dica(); as d) {
          <div class="dica" [style.left.%]="(d.x / largura) * 100" style="top: 2.5rem; transform: translateX(-50%)" role="status">
            <strong>{{ rotuloPeriodo(f.periodos[d.i]) }}</strong><br>
            <span class="chave" style="background: var(--viz-entrada)"></span>Entradas: {{ moeda(valor(f.periodos[d.i], 'entrada')) }}<br>
            <span class="chave" style="background: var(--viz-saida)"></span>Saídas: {{ moeda(valor(f.periodos[d.i], 'saida')) }}
          </div>
        }
      </section>

      <!-- ================================================================= saldo -->
      <section class="viz mb-3" aria-labelledby="tSaldo">
        <h2 id="tSaldo" class="h6">Saldo das contas</h2>
        <div class="small mb-1" aria-hidden="true">
          <span class="me-3"><svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" class="linha-realizado"></line></svg> Realizado</span>
          @if (f.previstoIncluido) { <span><svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" class="linha-projetado"></line></svg> Projetado (com o previsto)</span> }
        </div>
        <svg [attr.viewBox]="'0 0 ' + largura + ' ' + altura" class="w-100" role="img" aria-label="Saldo das contas ao fim de cada período; os mesmos valores estão na tabela abaixo.">
          @for (t of eixoSaldo().ticks; track t.valor) {
            <line class="grade" [attr.x1]="ml" [attr.x2]="largura" [attr.y1]="t.y" [attr.y2]="t.y"></line>
            <text [attr.x]="ml - 6" [attr.y]="t.y + 4" text-anchor="end">{{ curto(t.valor) }}</text>
          }
          <polyline class="linha-realizado" [attr.points]="linha().realizado"></polyline>
          @if (f.previstoIncluido) { <polyline class="linha-projetado" [attr.points]="linha().projetado"></polyline> }
          @for (p of linha().pontos; track p.i) {
            @if (p.rotulo) { <text [attr.x]="p.x" [attr.y]="altura - 8" text-anchor="middle">{{ p.rotulo }}</text> }
            @if (linha().pontos.length <= 40) { <circle class="ponto" [attr.cx]="p.x" [attr.cy]="p.yReal" r="4"></circle> }
          }
          @for (p of linha().pontos; track p.i) {
            <rect class="alvo" [attr.x]="p.x - p.meia" [attr.y]="mt" [attr.width]="p.meia * 2" [attr.height]="altura - mt - mb"
                  (mouseenter)="dicaSaldo.set({ i: p.i, x: p.x })" (mouseleave)="dicaSaldo.set(null)" (focus)="dicaSaldo.set({ i: p.i, x: p.x })" (blur)="dicaSaldo.set(null)" tabindex="0"
                  [attr.aria-label]="rotuloPeriodo(f.periodos[p.i]) + ': saldo ' + moeda(f.periodos[p.i].saldoRealizado)"></rect>
          }
        </svg>
        @if (dicaSaldo(); as d) {
          <div class="dica" [style.left.%]="(d.x / largura) * 100" style="top: 3rem; transform: translateX(-50%)" role="status">
            <strong>{{ rotuloPeriodo(f.periodos[d.i]) }}</strong><br>
            Realizado: {{ moeda(f.periodos[d.i].saldoRealizado) }}
            @if (f.previstoIncluido) { <br>Projetado: {{ moeda(f.periodos[d.i].saldoProjetado) }} }
          </div>
        }
      </section>

      <details class="mb-3" open>
        <summary class="h6">Tabela</summary>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Período</th><th class="text-end">Entradas previstas</th><th class="text-end">Saídas previstas</th><th class="text-end">Entradas realizadas</th><th class="text-end">Saídas realizadas</th><th class="text-end">Saldo realizado</th><th class="text-end">Saldo projetado</th></tr></thead>
            <tbody>
              @for (p of f.periodos; track p.inicio) {
                <tr>
                  <td>{{ rotuloPeriodo(p) }}</td>
                  <td class="text-end">{{ moeda(p.entradasPrevistas) }}</td><td class="text-end">{{ moeda(p.saidasPrevistas) }}</td>
                  <td class="text-end">{{ moeda(p.entradasRealizadas) }}</td><td class="text-end">{{ moeda(p.saidasRealizadas) }}</td>
                  <td class="text-end">{{ moeda(p.saldoRealizado) }}</td><td class="text-end">{{ moeda(p.saldoProjetado) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </details>

      <h2 class="h6">Contas</h2>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead><tr><th>Conta</th><th class="text-end">Saldo inicial</th><th>Em</th><th class="text-end">Saldo ao fim</th></tr></thead>
          <tbody>
            @for (c of f.contas; track c.contaId) {
              <tr><td>{{ c.nome }}@if (!c.ativo) { <span class="badge text-bg-secondary ms-1">Inativa</span> }</td><td class="text-end">{{ moeda(c.saldoInicial) }}</td><td>{{ data(c.dataSaldoInicial) }}</td><td class="text-end">{{ moeda(c.saldoFinal) }}</td></tr>
            } @empty { <tr><td colspan="4" class="text-secondary">Nenhuma conta cadastrada.</td></tr> }
          </tbody>
        </table>
      </div>
    } @else if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    }
  `
})
export class FluxoCaixaComponent implements OnInit {
  private service = inject(FinanceiroRelatoriosService);
  private cadastros = inject(FinanceiroCadastrosService);

  readonly largura = L;
  readonly altura = A;
  readonly ml = ML;
  readonly mt = MT;
  readonly mb = MB;

  de = `${mesAtual()}-01`;
  ate = ultimoDiaDoMes(mesAtual());
  agrupar: AgruparFluxo = 'dia';
  contaId: number | null = null;

  contas = signal<ContaFin[]>([]);
  fluxo = signal<FluxoCaixa | null>(null);
  carregando = signal(false);
  erro = signal('');
  medida = signal<Medida>('realizado');
  dica = signal<{ i: number; x: number } | null>(null);
  dicaSaldo = signal<{ i: number; x: number } | null>(null);

  private n = computed(() => this.fluxo()?.periodos.length ?? 0);
  private passoRotulo = computed(() => Math.max(1, Math.ceil(this.n() / 10)));

  /** Eixo vertical das barras: de 0 ao topo arredondado do maior valor mostrado. */
  eixoBarras = computed(() => {
    const f = this.fluxo();
    const max = f ? Math.max(0, ...f.periodos.flatMap(p => [this.valor(p, 'entrada'), this.valor(p, 'saida')])) : 0;
    const topo = topoDoEixo(max);
    const y = (v: number) => A - MB - (v / topo) * (A - MB - MT);
    return { topo, y, ticks: [0, 0.25, 0.5, 0.75, 1].map(k => ({ valor: topo * k, y: y(topo * k) })) };
  });

  barras = computed(() => {
    const f = this.fluxo();
    if (!f) return [];
    const { y } = this.eixoBarras();
    const larguraColuna = (L - ML) / Math.max(1, f.periodos.length);
    const largura = Math.max(2, Math.min(28, larguraColuna * 0.36));
    const base = y(0);
    return f.periodos.map((p, i) => {
      const x = ML + i * larguraColuna;
      const centro = x + larguraColuna / 2;
      const e = this.valor(p, 'entrada');
      const s = this.valor(p, 'saida');
      return {
        i, x, centro, largura, larguraAlvo: larguraColuna,
        xEntrada: centro - largura - 1, xSaida: centro + 1,
        yEntrada: y(e), hEntrada: Math.max(0, base - y(e)), ySaida: y(s), hSaida: Math.max(0, base - y(s)),
        rotulo: i % this.passoRotulo() === 0 ? this.rotuloCurto(p) : ''
      };
    });
  });

  /** O saldo pode ser negativo: o eixo vai do menor ao maior valor (sempre incluindo o zero). */
  eixoSaldo = computed(() => {
    const f = this.fluxo();
    const valores = f ? f.periodos.flatMap(p => [p.saldoRealizado, p.saldoProjetado]) : [0];
    const max = Math.max(0, ...valores);
    const min = Math.min(0, ...valores);
    const topo = max > 0 ? topoDoEixo(max) : 0;
    const fundo = min < 0 ? -topoDoEixo(-min) : 0;
    const intervalo = topo - fundo || 1;
    const y = (v: number) => A - MB - ((v - fundo) / intervalo) * (A - MB - MT);
    return { y, ticks: [0, 0.25, 0.5, 0.75, 1].map(k => ({ valor: fundo + intervalo * k, y: y(fundo + intervalo * k) })) };
  });

  linha = computed(() => {
    const f = this.fluxo();
    if (!f) return { realizado: '', projetado: '', pontos: [] as { i: number; x: number; yReal: number; meia: number; rotulo: string }[] };
    const { y } = this.eixoSaldo();
    const coluna = (L - ML) / Math.max(1, f.periodos.length);
    const x = (i: number) => ML + coluna * i + coluna / 2;
    return {
      realizado: f.periodos.map((p, i) => `${x(i)},${y(p.saldoRealizado)}`).join(' '),
      projetado: f.periodos.map((p, i) => `${x(i)},${y(p.saldoProjetado)}`).join(' '),
      pontos: f.periodos.map((p, i) => ({
        i, x: x(i), yReal: y(p.saldoRealizado), meia: coluna / 2, rotulo: i % this.passoRotulo() === 0 ? this.rotuloCurto(p) : ''
      }))
    };
  });

  ngOnInit() {
    this.cadastros.contas().subscribe({ next: l => this.contas.set(l), error: () => undefined });
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.service.fluxoCaixa({ de: this.de, ate: this.ate, agrupar: this.agrupar, contaId: this.contaId }).subscribe({
      next: f => {
        this.fluxo.set(f);
        this.carregando.set(false);
        if (!f.previstoIncluido) this.medida.set('realizado');
      },
      error: e => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar o fluxo de caixa.'), 'Não foi possível carregar o fluxo de caixa.')); }
    });
  }

  valor(p: FluxoPeriodo, lado: 'entrada' | 'saida'): number {
    if (this.medida() === 'realizado') return lado === 'entrada' ? p.entradasRealizadas : p.saidasRealizadas;
    return lado === 'entrada' ? p.entradasPrevistas : p.saidasPrevistas;
  }

  rotuloPeriodo(p: FluxoPeriodo): string {
    return p.inicio === p.fim ? formatarData(p.inicio) : `${formatarData(p.inicio)} a ${formatarData(p.fim)}`;
  }

  rotuloCurto(p: FluxoPeriodo): string {
    const f = this.fluxo();
    if (f?.agrupar === 'mes') return `${p.inicio.slice(5, 7)}/${p.inicio.slice(2, 4)}`;
    return `${p.inicio.slice(8, 10)}/${p.inicio.slice(5, 7)}`;
  }

  /** Eixo: 1,2 mil / 3,4 mi, curto para caber na margem. */
  curto(v: number): string {
    const a = Math.abs(v);
    const n = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    if (a >= 1_000_000) return `${n(v / 1_000_000)} mi`;
    if (a >= 1_000) return `${n(v / 1_000)} mil`;
    return n(v);
  }

  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }
}
