import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_INVENTARIO, ImobInventario, ROTULO_STATUS_INVENTARIO, inventarioCancelavel, inventarioEditavel, inventarioExcluivel
} from '../../../core/models/imob-inventario.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

type Acao = 'iniciar' | 'cancelar' | 'excluir';

@Component({
  selector: 'app-imob-inventario-detalhe',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './imob-inventario-detalhe.component.html'
})
export class ImobInventarioDetalheComponent implements OnInit {
  private service = inject(ImobInventarioService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  rotuloStatus = ROTULO_STATUS_INVENTARIO;
  classeStatus = CLASSE_STATUS_INVENTARIO;
  formatarDataHora = formatarDataHora;

  inventario = signal<ImobInventario | null>(null);
  loading = signal(false);
  erro = signal('');
  naoEncontrado = signal(false);
  agindo = signal<Acao | null>(null);

  podeEditar = computed(() => this.permissao.canEdit() && inventarioEditavel(this.inventario()?.status ?? 'concluido'));
  podeIniciar = computed(() => this.permissao.canEdit() && this.inventario()?.status === 'rascunho');
  podeCancelar = computed(() => this.permissao.canEdit() && inventarioCancelavel(this.inventario()?.status ?? 'concluido'));
  podeExcluir = computed(() => this.permissao.canDelete() && inventarioExcluivel(this.inventario()?.status ?? 'concluido'));
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
