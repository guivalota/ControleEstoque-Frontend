import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_INVENTARIO, ImobInventario, ROTULO_STATUS_INVENTARIO, inventarioCancelavel, inventarioEditavel, inventarioExcluivel
} from '../../../core/models/imob-inventario.model';
import { ImobConciliacaoService } from '../../../core/services/imob-conciliacao.service';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type Acao = 'iniciar' | 'cancelar' | 'excluir' | 'encerrar';

@Component({
  selector: 'app-imob-inventario-detalhe',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './imob-inventario-detalhe.component.html'
})
export class ImobInventarioDetalheComponent implements OnInit {
  private service = inject(ImobInventarioService);
  private route = inject(ActivatedRoute);
  private conciliacao = inject(ImobConciliacaoService);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  formatarData = formatarData;
  rotuloStatus = ROTULO_STATUS_INVENTARIO;
  classeStatus = CLASSE_STATUS_INVENTARIO;
  formatarDataHora = formatarDataHora;

  inventario = signal<ImobInventario | null>(null);
  loading = signal(false);
  erro = signal('');
  naoEncontrado = signal(false);
  agindo = signal<Acao | null>(null);

  podeEditar = computed(() => this.permissao.imobCanEdit() && inventarioEditavel(this.inventario()?.status ?? 'concluido'));
  podeIniciar = computed(() => this.permissao.imobCanEdit() && this.inventario()?.status === 'rascunho');
  podeCancelar = computed(() => this.permissao.imobCanEdit() && inventarioCancelavel(this.inventario()?.status ?? 'concluido'));
  podeExcluir = computed(() => this.permissao.imobCanDelete() && inventarioExcluivel(this.inventario()?.status ?? 'concluido'));
  podeEncerrar = computed(() => this.permissao.imobCanDelete() && this.inventario()?.status === 'em_andamento');
  /** Contagem e conciliação existem a partir do início; o relatório também (parcial até encerrar). */
  iniciado = computed(() => this.inventario()?.status !== 'rascunho');
  baixando = signal<'pdf' | 'csv' | null>(null);
  somenteLeitura = computed(() => {
    const s = this.inventario()?.status;
    return s === 'concluido' || s === 'cancelado';
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.naoEncontrado.set(false);
    this.service.obter(this.id).subscribe({
      next: inv => { this.inventario.set(inv); this.loading.set(false); },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o inventário.').mensagem);
        this.loading.set(false);
      }
    });
  }

  async iniciar() {
    const inv = this.inventario();
    if (!inv) return;
    const locais = inv.locais.map(l => l.localNome).join(', ');
    const ok = await this.confirmDialog().abrir({
      titulo: 'Iniciar contagem',
      mensagem: `Ao iniciar, a lista de bens esperados nos locais (${locais}, com sublocais) é congelada agora ` +
        'e o escopo não poderá mais ser alterado. Esta ação não pode ser desfeita (só é possível cancelar o inventário). Iniciar?',
      confirmar: 'Iniciar contagem'
    });
    if (!ok) return;
    this.executar('iniciar', this.service.iniciar(inv.id), 'Erro ao iniciar o inventário.');
  }

  async cancelar() {
    const inv = this.inventario();
    if (!inv) return;
    const ok = await this.confirmDialog().abrir({
      titulo: 'Cancelar inventário',
      mensagem: `Cancelar o inventário "${inv.nome}"? Ele fica no histórico somente para consulta e não pode ser reaberto.`,
      confirmar: 'Cancelar inventário',
      perigo: true
    });
    if (!ok) return;
    this.executar('cancelar', this.service.cancelar(inv.id), 'Erro ao cancelar o inventário.');
  }

  async encerrar() {
    const inv = this.inventario();
    if (!inv) return;
    this.erro.set('');
    this.agindo.set('encerrar');
    this.conciliacao.resumo(inv.id).subscribe({
      next: async r => {
        this.agindo.set(null);
        const pendentes = r.divergenciasPendentes + r.resolucoesDesatualizadas;
        const aviso = pendentes > 0
          ? `Existem ${pendentes} divergência(s) sem decisão válida. Encerrar mesmo assim? `
          : 'Encerrar o inventário? ';
        const ok = await this.confirmDialog().abrir({
          titulo: 'Encerrar inventário',
          mensagem: aviso + 'O resultado fica congelado e leituras e decisões deixam de ser aceitas. Esta ação não pode ser desfeita.',
          confirmar: pendentes > 0 ? 'Encerrar mesmo assim' : 'Encerrar',
          perigo: true
        });
        if (!ok) return;
        this.executar('encerrar', this.service.encerrar(inv.id, pendentes > 0), 'Erro ao encerrar o inventário.');
      },
      error: err => { this.agindo.set(null); this.erro.set(lerErroApi(err, 'Erro ao consultar as pendências.').mensagem); }
    });
  }

  baixarRelatorio(formato: 'pdf' | 'csv') {
    const inv = this.inventario();
    if (!inv) return;
    this.baixando.set(formato);
    this.erro.set('');
    this.service.relatorio(inv.id, formato).subscribe({
      next: a => { this.baixando.set(null); baixarBlob(a.blob, a.nome); },
      error: err => { this.baixando.set(null); this.erro.set(lerErroApi(err, 'Erro ao gerar o relatório.').mensagem); }
    });
  }

  async excluir() {
    const inv = this.inventario();
    if (!inv) return;
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir inventário',
      mensagem: `Excluir o inventário "${inv.nome}"?`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set('excluir');
    this.erro.set('');
    this.service.excluir(inv.id).subscribe({
      next: () => { this.agindo.set(null); this.router.navigate(['/imobilizado/inventarios']); },
      error: err => { this.agindo.set(null); this.erro.set(lerErroApi(err, 'Erro ao excluir o inventário.').mensagem); }
    });
  }

  private executar(acao: Acao, req: ReturnType<ImobInventarioService['iniciar']>, falha: string) {
    this.agindo.set(acao);
    this.erro.set('');
    req.subscribe({
      next: inv => { this.inventario.set(inv); this.agindo.set(null); },
      error: err => { this.agindo.set(null); this.erro.set(lerErroApi(err, falha).mensagem); }
    });
  }
}
