import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ImobConciliacaoService } from '../../../core/services/imob-conciliacao.service';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import {
  AcaoResolucao, CLASSE_SITUACAO, ConciliacaoItem, PainelInventario, ROTULO_SITUACAO, SITUACOES_CONCILIACAO,
  SituacaoConciliacao
} from '../../../core/models/imob-conciliacao.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';

const PAGE_SIZE = 50;
const INTERVALO_ATUALIZACAO_MS = 60_000;

type FiltroResolucao = '' | 'pendentes' | 'resolvidas';

@Component({
  selector: 'app-imob-conciliacao',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent, SeletorLocalComponent],
  templateUrl: './imob-conciliacao.component.html'
})
export class ImobConciliacaoComponent implements OnInit, OnDestroy {
  private service = inject(ImobConciliacaoService);
  private inventarios = inject(ImobInventarioService);
  private locais = inject(ImobLocalService);
  private route = inject(ActivatedRoute);
  permissao = inject(PermissaoService);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly pageSize = PAGE_SIZE;
  readonly situacoes = SITUACOES_CONCILIACAO;
  rotulo = ROTULO_SITUACAO;
  classe = CLASSE_SITUACAO;
  formatarDataHora = formatarDataHora;

  inventario = signal<ImobInventario | null>(null);
  painel = signal<PainelInventario | null>(null);
  itens = signal<ConciliacaoItem[]>([]);
  total = signal(0);
  page = signal(1);
  arvore = signal<ImobLocalArvore[]>([]);
  carregando = signal(false);
  naoEncontrado = signal(false);
  erro = signal('');

  situacao = signal<SituacaoConciliacao | ''>('');
  resolucaoFiltro = signal<FiltroResolucao>('pendentes');
  filtroLocal = new FormControl<number | null>(null);
  busca = new FormControl('', { nonNullable: true });

  // Decisão sobre uma plaqueta
  decidindo = signal<ConciliacaoItem | null>(null);
  acao = new FormControl<AcaoResolucao>('manter', { nonNullable: true });
  destino = new FormControl<number | null>(null);
  observacao = new FormControl('', { nonNullable: true });
  salvando = signal(false);
  erroDecisao = signal('');

  /** Decisões só valem com o inventário em andamento. */
  decisoesAbertas = computed(() => this.inventario()?.status === 'em_andamento' && this.permissao.imobCanEdit());

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.inventarios.obter(this.id).subscribe({
      next: inv => {
        this.inventario.set(inv);
        if (inv.status === 'rascunho') return;
        this.atualizar();
        if (inv.status === 'em_andamento') {
          this.timer = setInterval(() => this.atualizarPainel(), INTERVALO_ATUALIZACAO_MS);
        }
      },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o inventário.').mensagem);
      }
    });
    this.locais.arvore().subscribe({ next: a => this.arvore.set(a), error: () => this.arvore.set([]) });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  atualizar() {
    this.atualizarPainel();
    this.carregar();
  }

  atualizarPainel() {
    this.service.painel(this.id).subscribe({
      next: p => this.painel.set(p),
      error: err => this.erro.set(lerErroApi(err, 'Erro ao carregar o painel.').mensagem)
    });
  }

  carregar(page = this.page()) {
    this.carregando.set(true);
    const resolucao = this.resolucaoFiltro();
    this.service.listar(this.id, {
      situacao: this.situacao() || undefined,
      resolucao: resolucao || undefined,
      localId: this.filtroLocal.value ?? undefined,
      busca: this.busca.value.trim() || undefined,
      page, pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.page.set(r.page); this.carregando.set(false); },
      error: err => { this.carregando.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar a conciliação.').mensagem); }
    });
  }

  filtrarSituacao(s: SituacaoConciliacao | '') {
    this.situacao.set(s);
    // "Pendentes" não faz sentido para encontrados (nunca precisam de decisão).
    if (s === 'encontrado') this.resolucaoFiltro.set('');
    this.carregar(1);
  }

  filtrarResolucao(r: FiltroResolucao) {
    this.resolucaoFiltro.set(r);
    this.carregar(1);
  }

  contagem(s: SituacaoConciliacao): number {
    const r = this.painel()?.resumo;
    if (!r) return 0;
    return { encontrado: r.encontrados, local_divergente: r.localDivergente, nao_encontrado: r.naoEncontrados, sobra: r.sobras, duplicado: r.duplicados }[s];
  }

  /** Quem pode decidir este item: duplicado só admin; encontrado nunca. */
  podeDecidir(i: ConciliacaoItem): boolean {
    if (!this.decisoesAbertas() || i.situacao === 'encontrado') return false;
    return i.situacao !== 'duplicado' || this.permissao.imobCanDelete();
  }

  podeReabrir(i: ConciliacaoItem): boolean {
    return this.podeDecidir(i) && i.resolvida && i.resolucao?.acao === 'manter';
  }

  /** Ajustar local exige bem cadastrado, ao menos um local lido e bem não baixado (o servidor valida o resto). */
  podeAjustar(i: ConciliacaoItem): boolean {
    return i.bemId != null && i.situacao !== 'nao_encontrado' && i.locaisLidos.length > 0;
  }

  abrirDecisao(i: ConciliacaoItem) {
    this.decidindo.set(i);
    this.acao.setValue('manter');
    this.destino.setValue(i.situacao === 'duplicado' ? null : i.localLidoId ?? null);
    this.observacao.setValue('');
    this.erroDecisao.set('');
  }

  fecharDecisao() {
    this.decidindo.set(null);
  }

  salvarDecisao() {
    const i = this.decidindo();
    if (!i) return;
    const ajustar = this.acao.value === 'ajustar_local';
    if (ajustar && i.situacao === 'duplicado' && this.destino.value == null) {
      this.erroDecisao.set('Escolha o local que vale para este bem.');
      return;
    }
    this.salvando.set(true);
    this.erroDecisao.set('');
    this.service.resolver(this.id, {
      plaqueta: i.plaqueta,
      acao: this.acao.value,
      localDestinoId: ajustar ? this.destino.value ?? undefined : undefined,
      observacao: this.observacao.value.trim() || undefined
    }).subscribe({
      next: atualizado => {
        this.salvando.set(false);
        this.decidindo.set(null);
        this.substituir(atualizado);
        this.atualizarPainel();
      },
      error: err => { this.salvando.set(false); this.erroDecisao.set(lerErroApi(err, 'Erro ao registrar a decisão.').mensagem); }
    });
  }

  reabrir(i: ConciliacaoItem) {
    this.erro.set('');
    this.service.reabrir(this.id, i.plaqueta).subscribe({
      next: atualizado => { this.substituir(atualizado); this.atualizarPainel(); },
      error: err => this.erro.set(lerErroApi(err, 'Erro ao reabrir a divergência.').mensagem)
    });
  }

  /** No filtro "pendentes"/"resolvidas" o item sai da lista ao mudar de estado. */
  private substituir(item: ConciliacaoItem) {
    const filtro = this.resolucaoFiltro();
    const sai = (filtro === 'pendentes' && item.resolvida) || (filtro === 'resolvidas' && !item.resolvida);
    this.itens.update(l => sai
      ? l.filter(x => x.plaqueta.toLowerCase() !== item.plaqueta.toLowerCase())
      : l.map(x => x.plaqueta.toLowerCase() === item.plaqueta.toLowerCase() ? item : x));
    if (sai) this.total.update(t => Math.max(0, t - 1));
  }
}
