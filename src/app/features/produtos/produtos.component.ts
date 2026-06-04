import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { Produto, CreateProdutoRequest, UpdateProdutoRequest } from '../../core/models/produto.model';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './produtos.component.html'
})
export class ProdutosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  produtoService = inject(ProdutoService);
  categoriaService = inject(CategoriaService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;
  loading = this.produtoService.loading;

  searchTerm = signal('');
  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  filteredProdutos = computed(() => {
    const catMap = new Map(this.categorias().map(c => [c.id, c.nome]));
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.produtos().map(p => ({ ...p, categoriaNome: catMap.get(p.categoriaId) ?? '—' }));
    if (!term) return list;
    return list.filter(p => p.nome.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  });

  form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(100)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    descricao: ['' as string | null],
    categoriaId: [null as number | null, Validators.required],
    precoUnitario: [0, [Validators.required, Validators.min(0)]],
    estoqueMinimo: [null as number | null, Validators.min(0)],
    pontoReposicao: [null as number | null, Validators.min(0)],
    fazParteEstoque: [true],
    ativo: [true]
  });

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.categoriaService.getAll().subscribe();
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ ativo: true, precoUnitario: 0, descricao: null, estoqueMinimo: null, pontoReposicao: null, fazParteEstoque: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(p: Produto) {
    this.editingId.set(p.id);
    this.form.patchValue({ ...p, descricao: p.descricao ?? null, estoqueMinimo: p.estoqueMinimo ?? null, pontoReposicao: p.pontoReposicao ?? null });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.value;
    const id = this.editingId();

    const op = id
      ? this.produtoService.update(id, val as UpdateProdutoRequest)
      : this.produtoService.create(val as CreateProdutoRequest);

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar produto.');
        this.saving.set(false);
      }
    });
  }

  delete(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return;
    this.produtoService.delete(p.id).subscribe();
  }

  f(name: string) { return this.form.get(name)!; }
}
