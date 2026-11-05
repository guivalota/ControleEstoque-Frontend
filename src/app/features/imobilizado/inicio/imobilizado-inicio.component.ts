import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { ImobOrdemServicoService } from '../../../core/services/imob-ordem-servico.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { PainelDepreciacao } from '../../../core/models/imob-depreciacao.model';
import { CodigoAnterior } from '../../../core/models/imob-renovacao.model';
import { formatarMoeda } from '../../../core/utils/imob-formato';

interface Indicador { rotulo: string; valor: string; icone: string; link: string; destaque?: boolean }

const ROTULO_STATUS: Record<string, string> = {
  ativo: 'Ativos', em_manutencao: 'Em manutenção', baixado: 'Baixados', vendido: 'Vendidos', extraviado: 'Extraviados'
};

@Component({
  selector: 'app-imobilizado-inicio',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .kpi { transition: box-shadow .15s, transform .15s; }
    .kpi:hover { box-shadow: 0 .5rem 1rem rgba(0,0,0,.12) !important; transform: translateY(-1px); }
    .kpi-icone { width: 2.5rem; height: 2.5rem; border-radius: .6rem; display: inline-flex; align-items: center; justify-content: center; font-size: 1.2rem; flex: none; }
    .barra { height: .5rem; border-radius: .25rem; background: var(--bs-tertiary-bg); overflow: hidden; }
    .barra > span { display: block; height: 100%; background: var(--bs-primary); border-radius: .25rem; }
  `],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <h6 class="fw-bold mb-0">Visão geral do patrimônio</h6>
        @if (painel(); as p) { <small class="text-muted">Posição em {{ formatarData(p.em) }}</small> }
      </div>
      <div class="d-flex flex-wrap gap-2">
        @if (permissao.pode('imobilizado.bens.criar')) {
          <a routerLink="/imobilizado/bens/novo" class="btn btn-sm btn-primary"><i class="bi bi-plus-lg me-1"></i>Novo bem</a>
          <a routerLink="/imobilizado/bens/importar" class="btn btn-sm btn-outline-primary"><i class="bi bi-upload me-1"></i>Importar bens</a>
        }
        <a routerLink="/imobilizado/bens/renovar-etiquetas" class="btn btn-sm btn-outline-primary"><i class="bi bi-upc-scan me-1"></i>Renovar etiquetas</a>
      </div>
    </div>

    @if (carregando()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else {
      <div class="row g-3 mb-3">
        @for (i of indicadores(); track i.rotulo) {
          <div class="col-6 col-xl-3">
            <a [routerLink]="i.link" class="card kpi border-0 shadow-sm h-100 text-decoration-none text-body">
              <div class="card-body d-flex align-items-center gap-3">
                <span class="kpi-icone" [class]="i.destaque ? 'bg-warning-subtle text-warning-emphasis' : 'bg-primary-subtle text-primary'">
                  <i class="bi" [class]="i.icone"></i>
                </span>
                <div class="min-w-0">
                  <div class="fs-5 fw-bold text-truncate">{{ i.valor }}</div>
                  <div class="small text-muted">{{ i.rotulo }}</div>
                </div>
              </div>
            </a>
          </div>
        }
      </div>

      @if (painel(); as p) {
        @for (a of p.alertas; track a.codigo) {
          <div class="alert py-2 mb-2 small" [class.alert-danger]="a.severidade === 'critico'" [class.alert-warning]="a.severidade === 'aviso'" [class.alert-info]="a.severidade === 'info'">
            <i class="bi bi-exclamation-circle me-2"></i>{{ a.mensagem }}
          </div>
        }

        <div class="row g-3 mt-0">
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-header bg-transparent fw-semibold"><i class="bi bi-diagram-3 me-2"></i>Valor contábil por categoria</div>
              <div class="card-body">
                @for (c of categorias(); track c.nome) {
                  <div class="mb-3">
                    <div class="d-flex justify-content-between small">
                      <span class="fw-medium">{{ c.nome }} <span class="text-muted">· {{ c.quantidade }} {{ c.quantidade === 1 ? 'bem' : 'bens' }}</span></span>
                      <span>{{ formatarMoeda(c.valorContabil) }}</span>
                    </div>
                    <div class="barra mt-1"><span [style.width.%]="c.pct"></span></div>
                  </div>
                } @empty {
                  <p class="text-muted mb-0">Nenhum bem cadastrado ainda. Comece em <a routerLink="/imobilizado/bens/novo">Novo bem</a> ou <a routerLink="/imobilizado/bens/importar">Importar bens</a>.</p>
                }
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-header bg-transparent fw-semibold"><i class="bi bi-activity me-2"></i>Bens por situação</div>
              <ul class="list-group list-group-flush">
                @for (s of p.porStatus; track s.nome) {
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>{{ rotuloStatus(s.nome) }}</span><span class="badge text-bg-light border">{{ s.quantidade }}</span>
                  </li>
                } @empty {
                  <li class="list-group-item text-muted">Sem bens.</li>
                }
              </ul>
            </div>
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-transparent fw-semibold d-flex justify-content-between">
                <span><i class="bi bi-calendar-check me-2"></i>Últimos fechamentos</span>
                <a routerLink="/imobilizado/depreciacao" class="small fw-normal">Depreciação</a>
              </div>
              <ul class="list-group list-group-flush">
                @for (f of p.ultimosFechamentos; track f.competencia + f.revisao) {
                  <li class="list-group-item d-flex justify-content-between small">
                    <span>{{ f.mes }}</span><span class="text-muted">rev. {{ f.revisao }}</span>
                  </li>
                } @empty {
                  <li class="list-group-item text-muted small">Nenhum período fechado.</li>
                }
              </ul>
            </div>
          </div>
        </div>
      } @else if (erroPainel()) {
        <div class="alert alert-warning small">Não foi possível carregar os valores do patrimônio agora.</div>
      }
    }
  `
})
export class ImobilizadoInicioComponent implements OnInit {
  private bens = inject(ImobBemService);
  private depreciacao = inject(ImobDepreciacaoService);
  private inventarios = inject(ImobInventarioService);
  private ordens = inject(ImobOrdemServicoService);
  permissao = inject(PermissaoService);

  carregando = signal(true);
  painel = signal<PainelDepreciacao | null>(null);
  erroPainel = signal(false);
  private invAndamento = signal<number | null>(null);
  private osPendentes = signal<number | null>(null);
  private incompletos = signal<number | null>(null);
  private anterior = signal<CodigoAnterior | null>(null);

  formatarMoeda = formatarMoeda;

  indicadores = computed<Indicador[]>(() => {
    const p = this.painel();
    const lista: Indicador[] = [];
    if (p) {
      lista.push(
        { rotulo: 'Bens no patrimônio', valor: String(p.totais.quantidade), icone: 'bi-box-seam', link: '/imobilizado/bens' },
        { rotulo: 'Valor de aquisição', valor: formatarMoeda(p.totais.valorAquisicao), icone: 'bi-cash-stack', link: '/imobilizado/depreciacao' },
        { rotulo: 'Depreciação acumulada', valor: formatarMoeda(p.totais.acumulada), icone: 'bi-graph-down-arrow', link: '/imobilizado/depreciacao' },
        { rotulo: 'Valor contábil', valor: formatarMoeda(p.totais.valorContabil), icone: 'bi-bank', link: '/imobilizado/depreciacao' }
      );
    }
    const inv = this.invAndamento(), os = this.osPendentes(), inc = this.incompletos(), ant = this.anterior();
    if (inv !== null) lista.push({ rotulo: 'Inventários em andamento', valor: String(inv), icone: 'bi-clipboard-check', link: '/imobilizado/inventarios', destaque: inv > 0 });
    if (os !== null) lista.push({ rotulo: 'OS aguardando aprovação', valor: String(os), icone: 'bi-tools', link: '/imobilizado/ordens-servico', destaque: os > 0 });
    if (inc !== null) lista.push({ rotulo: 'Bens com dados incompletos', valor: String(inc), icone: 'bi-exclamation-triangle', link: '/imobilizado/bens', destaque: inc > 0 });
    if (ant && !ant.oculto) lista.push({ rotulo: 'Bens com código anterior', valor: String(ant.bensComCodigoAnterior), icone: 'bi-upc-scan', link: '/imobilizado/bens/renovar-etiquetas' });
    return lista;
  });

  categorias = computed(() => {
    const linhas = [...(this.painel()?.porCategoria ?? [])].sort((a, b) => b.valorContabil - a.valorContabil).slice(0, 8);
    const max = Math.max(...linhas.map(l => l.valorContabil), 0) || 1;
    return linhas.map(l => ({ ...l, pct: Math.max(2, (l.valorContabil / max) * 100) }));
  });

  ngOnInit() {
    // cada bloco falha sozinho (perfis diferentes enxergam partes diferentes)
    const ou = <T>(o: import('rxjs').Observable<T>) => o.pipe(catchError(() => of(null)));
    forkJoin({
      painel: ou(this.depreciacao.painel()),
      inv: ou(this.inventarios.listar({ status: 'em_andamento', page: 1, pageSize: 1 })),
      os: ou(this.ordens.listar({ status: 'pendente', page: 1, pageSize: 1 })),
      inc: ou(this.bens.listar({ dadosCompletos: false, page: 1, pageSize: 1 })),
      ant: ou(this.bens.obterCodigoAnterior())
    }).subscribe(r => {
      this.painel.set(r.painel);
      this.erroPainel.set(r.painel === null);
      this.invAndamento.set(r.inv?.total ?? null);
      this.osPendentes.set(r.os?.total ?? null);
      this.incompletos.set(r.inc?.total ?? null);
      this.anterior.set(r.ant);
      this.carregando.set(false);
    });
  }

  rotuloStatus(nome: string) {
    return ROTULO_STATUS[nome] ?? nome;
  }

  formatarData(iso: string) {
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
}
