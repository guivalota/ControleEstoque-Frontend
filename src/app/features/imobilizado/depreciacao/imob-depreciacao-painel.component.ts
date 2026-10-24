import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { AlertaDepreciacao, PainelDepreciacao, formatarMes } from '../../../core/models/imob-depreciacao.model';
import { ROTULO_STATUS_BEM } from '../../../core/models/imob-bem.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';

interface DestinoAlerta {
  rota: string;
  queryParams?: Record<string, string>;
  /** Telas que exigem escrita/admin não mostram botão para quem não pode. */
  exige?: 'admin';
}

/** Chave de navegação devolvida pela API → rota do front. */
const DESTINOS: Record<string, DestinoAlerta> = {
  'fechamento-depreciacao': { rota: '/imobilizado/depreciacao/fechamento' },
  'bens-dados-pendentes': { rota: '/imobilizado/bens', queryParams: { dadosCompletos: 'false' } },
  'bens-extraviados': { rota: '/imobilizado/bens', queryParams: { status: 'extraviado' } },
  'ordens-servico-pendentes': { rota: '/imobilizado/ordens-servico', queryParams: { status: 'pendente' } },
  'ordens-servico-em-andamento': { rota: '/imobilizado/ordens-servico', queryParams: { status: 'aprovada' } },
  'inventarios-em-andamento': { rota: '/imobilizado/inventarios', queryParams: { status: 'em_andamento' } },
  'relatorio-valor-contabil': { rota: '/imobilizado/depreciacao/relatorios' }
};

const CLASSE_SEVERIDADE: Record<AlertaDepreciacao['severidade'], string> = {
  critico: 'alert-danger',
  aviso: 'alert-warning',
  info: 'alert-info'
};

@Component({
  selector: 'app-imob-depreciacao-painel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './imob-depreciacao-painel.component.html'
})
export class ImobDepreciacaoPainelComponent implements OnInit {
  private service = inject(ImobDepreciacaoService);
  permissao = inject(PermissaoService);

  rotuloStatus = ROTULO_STATUS_BEM as Record<string, string>;
  classeSeveridade = CLASSE_SEVERIDADE;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarDataHora = formatarDataHora;
  formatarMes = formatarMes;

  painel = signal<PainelDepreciacao | null>(null);
  loading = signal(false);
  erro = signal('');

  /** Maior valor contábil por categoria: base da barra proporcional. */
  maxCategoria = computed(() => Math.max(1, ...(this.painel()?.porCategoria ?? []).map(c => c.valorContabil)));
  ultimoFechamento = computed(() => this.painel()?.ultimosFechamentos[0] ?? null);

  ngOnInit() {
    this.loading.set(true);
    this.service.painel().subscribe({
      next: p => { this.painel.set(p); this.loading.set(false); },
      error: err => { this.loading.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar o painel de depreciação.').mensagem); }
    });
  }

  destino(a: AlertaDepreciacao): DestinoAlerta | null {
    const d = DESTINOS[a.destino];
    if (!d) return null;
    return d.exige === 'admin' && !this.permissao.imobCanDelete() ? null : d;
  }

  nomeStatus(nome: string): string {
    return this.rotuloStatus[nome] ?? nome;
  }
}
