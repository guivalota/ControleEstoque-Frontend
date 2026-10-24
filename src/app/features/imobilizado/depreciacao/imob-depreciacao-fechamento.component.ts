import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ListaPeriodos, PeriodoFechado, PreviaDepreciacao, formatarMes } from '../../../core/models/imob-depreciacao.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { viewChild } from '@angular/core';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-imob-depreciacao-fechamento',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialogComponent, PaginacaoComponent],
  templateUrl: './imob-depreciacao-fechamento.component.html'
})
export class ImobDepreciacaoFechamentoComponent implements OnInit {
  private service = inject(ImobDepreciacaoService);
  permissao = inject(PermissaoService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  readonly pageSize = PAGE_SIZE;
  formatarMoeda = formatarMoeda;
  formatarDataHora = formatarDataHora;
  formatarMes = formatarMes;

  lista = signal<ListaPeriodos | null>(null);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  // Prévia / fechamento
  mesPrevia = signal<string | null>(null);
  previa = signal<PreviaDepreciacao | null>(null);
  paginaPrevia = signal(1);
  carregandoPrevia = signal(false);
  fechando = signal(false);
  /** Primeiro fechamento da empresa: o admin escolhe o mês (`yyyy-MM`). */
  mesInicial = new FormControl('', { nonNullable: true });

  // Reabertura
  reabrindo = signal<PeriodoFechado | null>(null);
  motivo = new FormControl('', { nonNullable: true });
  enviandoReabertura = signal(false);
  erroReabertura = signal('');

  periodos = computed(() => this.lista()?.periodos.items ?? []);
  /** Mês (`yyyy-MM`) sugerido para fechar: o seguinte ao último fechado. */
  proximoMes = computed(() => this.lista()?.proximaCompetenciaAFechar?.slice(0, 7) ?? null);
  podeFechar = computed(() => this.permissao.imobCanDelete());

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.periodos({ page: 1, pageSize: 100 }).subscribe({
      next: l => { this.lista.set(l); this.loading.set(false); },
      error: err => { this.loading.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar os períodos.').mensagem); }
    });
  }

  abrirPrevia(mes: string, page = 1) {
    this.mesPrevia.set(mes);
    this.carregandoPrevia.set(true);
    this.erro.set('');
    this.service.previa(mes, { page, pageSize: PAGE_SIZE }).subscribe({
      next: p => { this.previa.set(p); this.paginaPrevia.set(page); this.carregandoPrevia.set(false); },
      error: err => {
        this.carregandoPrevia.set(false);
        this.previa.set(null);
        this.mesPrevia.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao calcular a prévia.').mensagem);
      }
    });
  }

  abrirPreviaInicial() {
    const mes = this.mesInicial.value;
    if (/^\d{4}-\d{2}$/.test(mes)) this.abrirPrevia(mes);
    else this.erro.set('Informe o mês do primeiro fechamento.');
  }

  fecharPrevia() {
    this.mesPrevia.set(null);
    this.previa.set(null);
  }

  async fechar() {
    const mes = this.mesPrevia();
    const p = this.previa();
    if (!mes || !p) return;
    const ok = await this.confirmDialog().abrir({
      titulo: `Fechar ${formatarMes(p.competencia)}`,
      mensagem: `Os valores de ${p.totais.totalBens} bem(ns) ficam congelados: depreciação ${formatarMoeda(p.totais.totalDepreciacao)}, ` +
        `acumulada ${formatarMoeda(p.totais.totalAcumulada)}. Depois de fechado, só se corrige reabrindo o último período.`,
      confirmar: 'Fechar período'
    });
    if (!ok) return;
    this.fechando.set(true);
    this.erro.set('');
    this.service.fechar(mes).subscribe({
      next: periodo => {
        this.fechando.set(false);
        this.fecharPrevia();
        this.feedback.set(`Período ${formatarMes(periodo.competencia)} fechado.`);
        this.carregar();
      },
      error: err => {
        this.fechando.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao fechar o período.').mensagem);
        // Outro admin pode ter fechado antes: reflete o estado real.
        this.carregar();
      }
    });
  }

  abrirReabertura(p: PeriodoFechado) {
    this.reabrindo.set(p);
    this.motivo.reset('');
    this.erroReabertura.set('');
  }

  confirmarReabertura() {
    const p = this.reabrindo();
    if (!p) return;
    const motivo = this.motivo.value.trim();
    if (!motivo) { this.erroReabertura.set('Informe o motivo da reabertura.'); return; }
    this.enviandoReabertura.set(true);
    this.erroReabertura.set('');
    this.service.reabrir(p.mes, motivo).subscribe({
      next: () => {
        this.enviandoReabertura.set(false);
        this.reabrindo.set(null);
        this.feedback.set(`Período ${formatarMes(p.competencia)} reaberto. Corrija o cadastro e feche novamente.`);
        this.carregar();
      },
      error: err => {
        this.enviandoReabertura.set(false);
        this.erroReabertura.set(lerErroApi(err, 'Erro ao reabrir o período.').mensagem);
      }
    });
  }
}
