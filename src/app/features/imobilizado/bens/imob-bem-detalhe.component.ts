import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { CLASSE_STATUS_BEM, ImobBem, ROTULO_STATUS_BEM, bemEditavel } from '../../../core/models/imob-bem.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda, formatarVidaUtil } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobBemHistoricoComponent } from './imob-bem-historico.component';

type Aba = 'dados' | 'historico';

@Component({
  selector: 'app-imob-bem-detalhe',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent, ImobBemHistoricoComponent],
  templateUrl: './imob-bem-detalhe.component.html'
})
export class ImobBemDetalheComponent implements OnInit {
  private service = inject(ImobBemService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  rotuloStatus = ROTULO_STATUS_BEM;
  classeStatus = CLASSE_STATUS_BEM;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarDataHora = formatarDataHora;
  formatarVidaUtil = formatarVidaUtil;
  bemEditavel = bemEditavel;

  bem = signal<ImobBem | null>(null);
  loading = signal(false);
  erro = signal('');
  naoEncontrado = signal(false);
  excluindo = signal(false);

  aba = signal<Aba>('dados');
  /** O histórico só é buscado na primeira vez que a aba é aberta e depois fica montado. */
  historicoVisitado = signal(false);

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
    if (aba === 'historico') this.historicoVisitado.set(true);
  }

  /** Setas, Home e End alternam as abas (padrão WAI-ARIA de tabs). */
  aoTeclarAba(ev: KeyboardEvent) {
    const alvo: Aba | null =
      ev.key === 'ArrowRight' || ev.key === 'End' ? 'historico'
      : ev.key === 'ArrowLeft' || ev.key === 'Home' ? 'dados'
      : null;
    if (!alvo) return;
    ev.preventDefault();
    this.selecionarAba(alvo);
    (ev.currentTarget as HTMLElement).closest('[role="tablist"]')?.querySelector<HTMLElement>(alvo === 'dados' ? '#abaDados' : '#abaHistorico')?.focus();
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
