import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormatoArquivo, ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import {
  ComparacaoRevisoes, DiferencaRevisao, EventoHistoricoPeriodo, HistoricoPeriodo, ROTULO_CAMPO_DIFERENCA, RevisaoPeriodo,
  formatarMes
} from '../../../core/models/imob-depreciacao.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 20;

const ROTULO_EVENTO: Record<string, string> = { fechado: 'Fechado', reaberto: 'Reaberto', refechado: 'Fechado novamente' };
const ICONE_EVENTO: Record<string, string> = {
  fechado: 'bi-lock-fill text-success', reaberto: 'bi-unlock-fill text-warning', refechado: 'bi-arrow-repeat text-primary'
};
const ROTULO_SITUACAO: Record<string, string> = { alterado: 'Alterado', incluido: 'Incluído', removido: 'Removido' };

@Component({
  selector: 'app-imob-depreciacao-periodo',
  standalone: true,
  imports: [RouterLink, PaginacaoComponent],
  templateUrl: './imob-depreciacao-periodo.component.html'
})
export class ImobDepreciacaoPeriodoComponent implements OnInit {
  private service = inject(ImobDepreciacaoService);
  private route = inject(ActivatedRoute);

  readonly mes = this.route.snapshot.paramMap.get('mes') ?? '';
  readonly pageSize = PAGE_SIZE;
  rotuloEvento = ROTULO_EVENTO;
  iconeEvento = ICONE_EVENTO;
  rotuloSituacao = ROTULO_SITUACAO;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarDataHora = formatarDataHora;
  formatarMes = formatarMes;

  historico = signal<HistoricoPeriodo | null>(null);
  loading = signal(false);
  naoEncontrado = signal(false);
  erro = signal('');
  baixando = signal<FormatoArquivo | null>(null);

  revisao = signal<RevisaoPeriodo | null>(null);
  paginaRevisao = signal(1);
  carregandoRevisao = signal(false);

  comparacao = signal<ComparacaoRevisoes | null>(null);
  paginaComparacao = signal(1);
  carregandoComparacao = signal(false);
  de = signal<number | null>(null);
  para = signal<number | null>(null);

  revisoes = computed(() => {
    const max = Math.max(0, ...(this.historico()?.eventos ?? []).map(e => e.revisao));
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  ngOnInit() {
    this.loading.set(true);
    this.service.historico(this.mes).subscribe({
      next: h => {
        this.historico.set(h);
        this.loading.set(false);
        const r = this.revisoes();
        if (r.length > 1) { this.de.set(r[r.length - 2]); this.para.set(r[r.length - 1]); }
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o histórico do período.').mensagem);
      }
    });
  }

  verRevisao(n: number, page = 1) {
    this.carregandoRevisao.set(true);
    this.erro.set('');
    this.service.revisao(this.mes, n, { page, pageSize: PAGE_SIZE }).subscribe({
      next: r => { this.revisao.set(r); this.paginaRevisao.set(page); this.carregandoRevisao.set(false); },
      error: err => { this.carregandoRevisao.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar a revisão.').mensagem); }
    });
  }

  comparar(page = 1) {
    const de = this.de();
    const para = this.para();
    if (de === null || para === null) return;
    if (de === para) { this.erro.set('Escolha duas revisões diferentes.'); return; }
    this.carregandoComparacao.set(true);
    this.erro.set('');
    this.service.comparar(this.mes, de, para, { page, pageSize: PAGE_SIZE }).subscribe({
      next: c => { this.comparacao.set(c); this.paginaComparacao.set(page); this.carregandoComparacao.set(false); },
      error: err => { this.carregandoComparacao.set(false); this.erro.set(lerErroApi(err, 'Erro ao comparar as revisões.').mensagem); }
    });
  }

  baixarHistorico(formato: FormatoArquivo) {
    this.baixar(formato, this.service.baixarHistorico(this.mes, formato));
  }

  baixarComparacao(formato: FormatoArquivo) {
    const c = this.comparacao();
    if (c) this.baixar(formato, this.service.baixarComparacao(this.mes, c.de, c.para, formato));
  }

  private baixar(formato: FormatoArquivo, req: ReturnType<ImobDepreciacaoService['baixarHistorico']>) {
    this.baixando.set(formato);
    this.erro.set('');
    req.subscribe({
      next: a => { this.baixando.set(null); baixarBlob(a.blob, a.nome); },
      error: err => { this.baixando.set(null); this.erro.set(lerErroApi(err, 'Erro ao gerar o arquivo.').mensagem); }
    });
  }

  setSelecao(campo: 'de' | 'para', valor: string) {
    (campo === 'de' ? this.de : this.para).set(valor ? Number(valor) : null);
  }

  rotuloCampo(campo: string): string {
    return ROTULO_CAMPO_DIFERENCA[campo] ?? campo;
  }

  /** Valor de um campo alterado numa linha (monetários em BRL, datas dd/MM/yyyy). */
  valorCampo(linha: DiferencaRevisao['antes'], campo: string): string {
    if (!linha) return '—';
    const v = (linha as Record<string, unknown>)[campo];
    if (v === null || v === undefined || v === '') return '—';
    if (['quota', 'acumulada', 'valorContabil', 'valorAquisicao', 'valorResidual'].includes(campo)) return formatarMoeda(Number(v));
    if (['dataAquisicao', 'dataBaixa'].includes(campo)) return formatarData(String(v));
    if (campo === 'categoriaId') return linha.categoriaNome ?? `#${v}`;
    if (campo === 'localId') return linha.localNome ?? `#${v}`;
    if (campo === 'responsavelId') return linha.responsavelNome ?? `#${v}`;
    return String(v);
  }

  variacaoClasse(v: number): string {
    return v > 0 ? 'text-success' : v < 0 ? 'text-danger' : '';
  }

  eventoComVariacao(e: EventoHistoricoPeriodo): boolean {
    return !!e.variacao && !!e.totaisAnteriores;
  }
}
