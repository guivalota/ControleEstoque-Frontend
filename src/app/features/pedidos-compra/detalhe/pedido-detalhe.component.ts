import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Modal } from 'bootstrap';
import { PedidoCompraService } from '../../../core/services/pedido-compra.service';
import { ImpressaoService } from '../../../core/services/impressao.service';
import { ProdutoService } from '../../../core/services/produto.service';
import { UserService } from '../../../core/services/user.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { PedidoCompra, PedidoCompraItem } from '../../../core/models/pedido-compra.model';

@Component({
  selector: 'app-pedido-detalhe',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  templateUrl: './pedido-detalhe.component.html'
})
export class PedidoDetalheComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private pedidoService = inject(PedidoCompraService);
  private impressaoService = inject(ImpressaoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  produtoService = inject(ProdutoService);
  userService = inject(UserService);
  permissao = inject(PermissaoService);

  @ViewChild('editModalEl') editModalEl!: ElementRef;
  @ViewChild('addItemModalEl') addItemModalEl!: ElementRef;
  private editModal!: Modal;
  private addItemModal!: Modal;

  pedido = signal<PedidoCompra | null>(null);
  loading = signal(true);
  erro = signal('');
  saving = signal(false);
  saveError = signal('');
  imprimindo = signal(false);
  impressaoErro = signal('');

  produtos = this.produtoService.produtos;
  usuarios = this.userService.users;

  editForm = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(255)]],
    destinadoA: [null as string | null],
    observacao: ['' as string | null]
  });

  addItemForm = this.fb.group({
    produtoId: [null as number | null, Validators.required],
    quantidadeSolicitada: [1, [Validators.required, Validators.min(1)]],
    observacao: ['' as string | null]
  });

  private pedidoId = 0;

  ngOnInit() {
    this.pedidoId = Number(this.route.snapshot.paramMap.get('id'));
    this.produtoService.getAll().subscribe();
    this.userService.getAll().subscribe();
    this.carregar();
  }

  ngOnDestroy() {
    this.editModal?.dispose();
    this.addItemModal?.dispose();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.pedidoService.getById(this.pedidoId).subscribe({
      next: p => { this.pedido.set(p); this.loading.set(false); },
      error: () => { this.erro.set('Pedido não encontrado.'); this.loading.set(false); }
    });
  }

  private getEditModal(): Modal {
    if (!this.editModal) this.editModal = new Modal(this.editModalEl.nativeElement);
    return this.editModal;
  }

  private getAddItemModal(): Modal {
    if (!this.addItemModal) this.addItemModal = new Modal(this.addItemModalEl.nativeElement);
    return this.addItemModal;
  }

  abrirEditar() {
    const p = this.pedido()!;
    this.editForm.patchValue({ descricao: p.descricao, destinadoA: p.destinadoA ?? null, observacao: p.observacao ?? null });
    this.saveError.set('');
    this.getEditModal().show();
  }

  salvarEdicao() {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const val = this.editForm.value;
    this.pedidoService.update(this.pedidoId, {
      descricao: val.descricao!,
      destinadoA: val.destinadoA || null,
      observacao: val.observacao || null
    }).subscribe({
      next: () => { this.saving.set(false); this.getEditModal().hide(); this.carregar(); },
      error: (err) => { this.saveError.set(err.error?.message ?? 'Erro ao atualizar pedido.'); this.saving.set(false); }
    });
  }

  abrirAddItem() {
    this.addItemForm.reset({ quantidadeSolicitada: 1, observacao: null, produtoId: null });
    this.saveError.set('');
    this.getAddItemModal().show();
  }

  salvarItem() {
    if (this.addItemForm.invalid) { this.addItemForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const val = this.addItemForm.value;
    this.pedidoService.addItem(this.pedidoId, {
      produtoId: +val.produtoId!,
      quantidadeSolicitada: +val.quantidadeSolicitada!,
      observacao: val.observacao || null
    }).subscribe({
      next: () => { this.saving.set(false); this.getAddItemModal().hide(); this.carregar(); },
      error: (err) => { this.saveError.set(err.error?.message ?? 'Erro ao adicionar item.'); this.saving.set(false); }
    });
  }

  removerItem(item: PedidoCompraItem) {
    if (!confirm(`Remover "${item.produtoNome}" do pedido?`)) return;
    this.pedidoService.removeItem(this.pedidoId, item.id).subscribe({
      next: () => this.carregar(),
      error: (err) => alert(err.error?.message ?? 'Erro ao remover item.')
    });
  }

  cancelarPedido() {
    if (!confirm('Cancelar este pedido? Esta ação não pode ser desfeita.')) return;
    this.pedidoService.cancel(this.pedidoId).subscribe({
      next: () => this.carregar(),
      error: (err) => alert(err.error?.message ?? 'Erro ao cancelar pedido.')
    });
  }

  podeRemoverItem(item: PedidoCompraItem): boolean {
    return item.quantidadeAtendida === 0 && this.pedido()?.status === 'aberto';
  }

  progressoClass(pct: number): string {
    if (pct >= 100) return 'bg-success';
    if (pct > 0) return 'bg-primary';
    return 'bg-secondary';
  }

  statusBadge(status: string): string {
    const map: Record<string, string> = {
      aberto: 'bg-primary', atendido: 'bg-success', cancelado: 'bg-secondary'
    };
    return map[status] ?? 'bg-secondary';
  }

  imprimir() {
    this.imprimindo.set(true);
    this.impressaoErro.set('');
    this.impressaoService.imprimirPedido(this.pedidoId).subscribe({
      next: blob => { this.impressaoService.abrirPdf(blob); this.imprimindo.set(false); },
      error: err => {
        this.impressaoErro.set(err.error?.message ?? 'Erro ao gerar PDF.');
        this.imprimindo.set(false);
      }
    });
  }

  voltar() { this.router.navigate(['/pedidos-compra']); }

  ef(name: string) { return this.editForm.get(name)!; }
  af(name: string) { return this.addItemForm.get(name)!; }
}
