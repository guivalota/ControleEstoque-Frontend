import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { LoteService } from '../../core/services/lote.service';
import { ProdutoService } from '../../core/services/produto.service';
import { FornecedorService } from '../../core/services/fornecedor.service';
import { PermissaoService } from '../../core/services/permissao.service';
import {
  CreateLoteRequest, Lote, SituacaoLote, UpdateLoteRequest, diasParaVencer, situacaoLote
} from '../../core/models/lote.model';

type FiltroValidade = '' | 'vencidos' | 'vencendo';

const DIAS_ALERTA = 30;

@Component({
  selector: 'app-lotes',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './lotes.component.html'
})
export class LotesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private loteService = inject(LoteService);
  private produtoService = inject(ProdutoService);
  private fornecedorService = inject(FornecedorService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  produtos = this.produtoService.produtos;
  fornecedores = this.fornecedorService.fornecedores;

  readonly pageSize = 50;
  readonly diasAlerta = DIAS_ALERTA;
  lotes = signal<Lote[]>([]);
  total = signal(0);
  currentPage = signal(1);
  loading = signal(false);
  erro = signal('');

  filterProdutoId = signal<number | null>(null);
  filterValidade = signal<FiltroValidade>('');

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  form = this.fb.group({
    produtoId: [null as number | null, Validators.required],
    numeroLote: ['', [Validators.required, Validators.maxLength(100)]],
    dataFabricacao: ['' as string | null],
    dataValidade: ['' as string | null],
    quantidadeInicial: [1, [Validators.required, Validators.min(1)]],
    fornecedorId: [null as number | null],
    observacao: ['' as string | null, Validators.maxLength(2000)]
  });

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.fornecedorService.getAll().subscribe();
    this.carregar(1);
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  carregar(page = this.currentPage()) {
    this.loading.set(true);
    this.erro.set('');
    const validade = this.filterValidade();
    this.loteService.getAll({
      ProdutoId: this.filterProdutoId() ?? undefined,
      Vencidos: validade === 'vencidos' ? true : undefined,
      Vencendo: validade === 'vencendo' ? true : undefined,
      DiasVencendo: validade === 'vencendo' ? DIAS_ALERTA : undefined,
      Page: page, PageSize: this.pageSize
    }).subscribe({
      next: r => { this.lotes.set(r.items); this.total.set(r.total); this.currentPage.set(page); this.loading.set(false); },
      error: err => { this.loading.set(false); this.erro.set(err.error?.error ?? 'Erro ao carregar os lotes.'); }
    });
  }

  setProduto(valor: string) {
    this.filterProdutoId.set(valor ? +valor : null);
    this.carregar(1);
  }

  setValidade(valor: string) {
    this.filterValidade.set(valor as FiltroValidade);
    this.carregar(1);
  }

  produtoNome(id: number): string {
    const p = this.produtos().find(x => x.id === id);
    return p ? `${p.sku} — ${p.nome}` : `Produto #${id}`;
  }

  fornecedorNome(id: number | null | undefined): string {
    if (!id) return '—';
    return this.fornecedores().find(f => f.id === id)?.razaoSocial ?? `#${id}`;
  }

  situacao(l: Lote): SituacaoLote {
    return situacaoLote(l.dataValidade, DIAS_ALERTA);
  }

  dias(l: Lote): number | null {
    return diasParaVencer(l.dataValidade);
  }

  /** dd/MM/yyyy sem passar por Date (evita deslocamento de fuso). */
  data(iso: string | null | undefined): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({
      produtoId: this.filterProdutoId(), numeroLote: '', dataFabricacao: null, dataValidade: null,
      quantidadeInicial: 1, fornecedorId: null, observacao: null
    });
    this.form.controls.produtoId.enable();
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(l: Lote) {
    this.editingId.set(l.id);
    this.form.reset({
      produtoId: l.produtoId, numeroLote: l.numeroLote, dataFabricacao: l.dataFabricacao ?? null,
      dataValidade: l.dataValidade ?? null, quantidadeInicial: l.quantidadeInicial,
      fornecedorId: l.fornecedorId ?? null, observacao: l.observacao ?? null
    });
    this.form.controls.produtoId.disable();
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const v = this.form.getRawValue();
    const comum = {
      numeroLote: v.numeroLote!.trim(),
      dataFabricacao: v.dataFabricacao || null,
      dataValidade: v.dataValidade || null,
      quantidadeInicial: +v.quantidadeInicial!,
      fornecedorId: v.fornecedorId ? +v.fornecedorId : null,
      observacao: v.observacao?.trim() || null
    };
    const id = this.editingId();
    const op = id
      ? this.loteService.update(id, comum as UpdateLoteRequest)
      : this.loteService.create({ ...comum, produtoId: +v.produtoId! } as CreateLoteRequest);
    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); this.carregar(); },
      error: err => {
        this.saving.set(false);
        const erros = err.error?.errors ? Object.values(err.error.errors as Record<string, string[]>).flat().join(' ') : '';
        this.saveError.set(err.error?.error ?? (erros || 'Erro ao salvar o lote.'));
      }
    });
  }

  delete(l: Lote) {
    if (!confirm(`Excluir o lote "${l.numeroLote}"?`)) return;
    this.erro.set('');
    this.loteService.delete(l.id).subscribe({
      next: () => this.carregar(),
      error: err => this.erro.set(err.error?.error ?? 'Erro ao excluir o lote.')
    });
  }

  f(name: string) { return this.form.get(name)!; }
}
