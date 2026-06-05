import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Modal } from 'bootstrap';
import { PedidoCompraService } from '../../core/services/pedido-compra.service';
import { ProdutoService } from '../../core/services/produto.service';
import { UserService } from '../../core/services/user.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { PedidoCompra, PedidoStatus } from '../../core/models/pedido-compra.model';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-pedidos-compra',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './pedidos-compra.component.html'
})
export class PedidosCompraComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private pedidoService = inject(PedidoCompraService);
  private router = inject(Router);
  produtoService = inject(ProdutoService);
  userService = inject(UserService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  pedidos = signal<PedidoCompra[]>([]);
  loading = signal(false);
  saving = signal(false);
  saveError = signal('');
  total = signal(0);
  page = signal(1);
  readonly pageSize = PAGE_SIZE;

  filterStatus = signal<PedidoStatus | ''>('');
  filterCriadoPor = signal('');
  filterDestinadoA = signal('');

  produtos = this.produtoService.produtos;
  usuarios = this.userService.users;

  form = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(255)]],
    destinadoA: [null as string | null],
    observacao: ['' as string | null],
    itens: this.fb.array([this.criarItemGroup()])
  });

  get itens(): FormArray { return this.form.get('itens') as FormArray; }

  criarItemGroup(): FormGroup {
    return this.fb.group({
      produtoId: [null as number | null, Validators.required],
      quantidadeSolicitada: [1, [Validators.required, Validators.min(1)]],
      observacao: ['' as string | null]
    });
  }

  addItem() { this.itens.push(this.criarItemGroup()); }
  removeItem(i: number) { if (this.itens.length > 1) this.itens.removeAt(i); }

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.userService.getAll().subscribe();
    this.carregar(1);
  }

  ngOnDestroy() { this.modal?.dispose(); }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  carregar(page = 1) {
    this.loading.set(true);
    this.pedidoService.getAll({
      status: this.filterStatus() || undefined,
      criadoPor: this.filterCriadoPor() || undefined,
      destinadoA: this.filterDestinadoA() || undefined,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.pedidos.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  limparFiltros() {
    this.filterStatus.set('');
    this.filterCriadoPor.set('');
    this.filterDestinadoA.set('');
    this.carregar(1);
  }

  hasNextPage() { return this.page() * this.pageSize < this.total(); }

  abrirNovo() {
    while (this.itens.length > 1) this.itens.removeAt(1);
    this.form.reset({ descricao: '', destinadoA: null, observacao: null });
    this.itens.at(0).reset({ quantidadeSolicitada: 1, observacao: null, produtoId: null });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const val = this.form.value;
    this.pedidoService.create({
      descricao: val.descricao!,
      destinadoA: val.destinadoA || null,
      observacao: val.observacao || null,
      itens: (val.itens as any[]).map(i => ({
        produtoId: +i.produtoId,
        quantidadeSolicitada: +i.quantidadeSolicitada,
        observacao: i.observacao || null
      }))
    }).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.getModal().hide();
        this.router.navigate(['/pedidos-compra', p.id]);
      },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao criar pedido.');
        this.saving.set(false);
      }
    });
  }

  abrirDetalhe(id: number) { this.router.navigate(['/pedidos-compra', id]); }

  statusBadge(status: PedidoStatus): string {
    const map: Record<PedidoStatus, string> = {
      aberto: 'bg-primary',
      atendido: 'bg-success',
      cancelado: 'bg-secondary'
    };
    return map[status] ?? 'bg-secondary';
  }

  statusLabel(status: PedidoStatus): string {
    const map: Record<PedidoStatus, string> = {
      aberto: 'Aberto', atendido: 'Atendido', cancelado: 'Cancelado'
    };
    return map[status] ?? status;
  }

  resumoItens(p: PedidoCompra): string {
    const total = p.itens.length;
    const atendidos = p.itens.filter(i => i.quantidadeAtendida >= i.quantidadeSolicitada).length;
    return `${atendidos}/${total}`;
  }

  f(name: string) { return this.form.get(name)!; }
  iCtrl(i: number, name: string) { return this.itens.at(i).get(name)!; }
}
