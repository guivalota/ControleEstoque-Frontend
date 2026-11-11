import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { CLASSE_STATUS_BEM, ImobBem, ROTULO_STATUS_BEM, bemEditavel } from '../../../core/models/imob-bem.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda, formatarVidaUtil } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobEtiquetasDialogComponent } from '../shared/imob-etiquetas-dialog.component';
import { ImobReplicarDialogComponent } from '../shared/imob-replicar-dialog.component';
import { ToastService } from '../../../core/services/toast.service';
import { ReplicarImobBemResultado } from '../../../core/models/imob-bem.model';
import { ImobBemHistoricoComponent } from './imob-bem-historico.component';
import { ImobBemDepreciacaoComponent } from './imob-bem-depreciacao.component';
import { ImobBemFotosComponent } from './imob-bem-fotos.component';
import { ImobBemConferenciasComponent } from './imob-bem-conferencias.component';
import { formatarValorCampo } from '../../../core/utils/campo-customizado';

type Aba = 'dados' | 'fotos' | 'conferencias' | 'historico' | 'depreciacao';
const ABAS: Aba[] = ['dados', 'fotos', 'conferencias', 'historico', 'depreciacao'];
const ID_ABA: Record<Aba, string> = {
  dados: '#abaDados', fotos: '#abaFotos', conferencias: '#abaConferencias', historico: '#abaHistorico', depreciacao: '#abaDepreciacao'
};

@Component({
  selector: 'app-imob-bem-detalhe',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent, ImobEtiquetasDialogComponent, ImobReplicarDialogComponent, ImobBemHistoricoComponent, ImobBemDepreciacaoComponent, ImobBemFotosComponent, ImobBemConferenciasComponent],
  templateUrl: './imob-bem-detalhe.component.html'
})
export class ImobBemDetalheComponent implements OnInit {
  private service = inject(ImobBemService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private etiquetasDialog = viewChild.required(ImobEtiquetasDialogComponent);
  private replicarDialog = viewChild.required(ImobReplicarDialogComponent);
  private toast = inject(ToastService);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  rotuloStatus = ROTULO_STATUS_BEM;
  classeStatus = CLASSE_STATUS_BEM;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarDataHora = formatarDataHora;
  formatarVidaUtil = formatarVidaUtil;
  formatarCampo = formatarValorCampo;
  bemEditavel = bemEditavel;

  bem = signal<ImobBem | null>(null);
  loading = signal(false);
  erro = signal('');
  naoEncontrado = signal(false);
  excluindo = signal(false);

  aba = signal<Aba>('dados');
  /** O histórico só é buscado na primeira vez que a aba é aberta e depois fica montado. */
  historicoVisitado = signal(false);
  fotosVisitada = signal(false);
  conferenciasVisitada = signal(false);
  depreciacaoVisitada = signal(false);

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.naoEncontrado.set(false);
    this.service.obter(this.id).subscribe({
      next: bem => { this.bem.set(bem); this.loading.set(false); },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o bem.').mensagem);
        this.loading.set(false);
      }
    });
  }

  selecionarAba(aba: Aba) {
    this.aba.set(aba);
    if (aba === 'fotos') this.fotosVisitada.set(true);
    if (aba === 'conferencias') this.conferenciasVisitada.set(true);
    if (aba === 'historico') this.historicoVisitado.set(true);
    if (aba === 'depreciacao') this.depreciacaoVisitada.set(true);
  }

  /** "Conferências" só aparece para quem pode ver as leituras do inventário (o servidor é a autoridade). */
  podeVerConferencias = computed(() => this.permissao.pode('imobilizado.inventarios-leituras.ver'));

  abasVisiveis = computed(() => ABAS.filter(a => a !== 'conferencias' || this.podeVerConferencias()));

  /** Setas, Home e End alternam as abas (padrão WAI-ARIA de tabs). */
  aoTeclarAba(ev: KeyboardEvent) {
    const abas = this.abasVisiveis();
    const atual = abas.indexOf(this.aba());
    const alvo: Aba | null =
      ev.key === 'ArrowRight' ? abas[Math.min(atual + 1, abas.length - 1)]
      : ev.key === 'ArrowLeft' ? abas[Math.max(atual - 1, 0)]
      : ev.key === 'End' ? abas[abas.length - 1]
      : ev.key === 'Home' ? abas[0]
      : null;
    if (!alvo) return;
    ev.preventDefault();
    this.selecionarAba(alvo);
    (ev.currentTarget as HTMLElement).closest('[role="tablist"]')?.querySelector<HTMLElement>(ID_ABA[alvo])?.focus();
  }

  imprimirEtiqueta() {
    this.etiquetasDialog().abrir({ ids: [this.id] }, 'rolo-50x30');
  }

  replicar() {
    const bem = this.bem();
    if (bem) this.replicarDialog().abrir(bem);
  }

  aoReplicar(r: ReplicarImobBemResultado) {
    this.toast.sucesso(`${r.total} ${r.total === 1 ? 'cópia criada' : 'cópias criadas'} a partir de ${r.origemPlaqueta}.`);
    this.router.navigate(['/imobilizado/bens']);
  }

  async excluir() {
    const bem = this.bem();
    if (!bem) return;
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir bem',
      mensagem: `Excluir o bem ${bem.plaqueta} — ${bem.descricao}? A exclusão fica registrada no histórico.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.excluindo.set(true);
    this.service.excluir(bem.id).subscribe({
      next: () => { this.excluindo.set(false); this.router.navigate(['/imobilizado/bens']); },
      error: err => {
        this.excluindo.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao excluir bem.').mensagem);
      }
    });
  }
}
