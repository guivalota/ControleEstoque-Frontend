import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { startWith } from 'rxjs/operators';
import { Modal } from 'bootstrap';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { Movimentacao, CreateMovimentacaoRequest, UpdateMovimentacaoRequest, TipoMovimentacao, MotivoAjuste } from '../../core/models/movimentacao.model';

@Component({
  selector: 'app-movimentacoes',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe],
  templateUrl: './movimentacoes.component.html'
})
export class MovimentacoesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  movimentacaoService = inject(MovimentacaoService);
  produtoService = inject(ProdutoService);
  categoriaService = inject(CategoriaService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  movimentacoes = this.movimentacaoService.movimentacoes;
  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;
  loading = this.movimentacaoService.loading;

  filterProdutoId = signal<number | null>(null);
  filterDataInicio = signal('');
  filterDataFim = signal('');
  filterCategoriaId = signal<number | null>(null);

  readonly pageSize = 50;
  currentPage = signal(1);
  hasNextPage = signal(false);

  editingId = signal<number | null>(null);
  editingProdutoNome = signal('');
  saving = signal(false);
  saveError = signal('');

  filteredMovimentacoes = computed(() => {
    const prodMap = new Map(this.produtos().map(p => [p.id, p.nome]));
    return [...this.movimentacoes()]
      .sort((a, b) => {
        const dateA = a.dataMovimentacao ?? a.criadoEm;
        const dateB = b.dataMovimentacao ?? b.criadoEm;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .map(m => ({ ...m, produtoNome: prodMap.get(m.produtoId) ?? m.produtoNome }));
  });

  form = this.fb.group({
    produtoId: [null as number | null, Validators.required],
    tipo: ['entrada' as TipoMovimentacao, Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    valorUnitario: [0, [Validators.required, Validators.min(0)]],
    dataMovimentacao: ['' as string | null],
    observacao: ['' as string | null],
    motivoAjuste: [null as MotivoAjuste | null]
  });

  private tipoValue = toSignal(
    this.form.controls['tipo'].valueChanges.pipe(startWith(this.form.controls['tipo'].value)),
    { initialValue: 'entrada' as TipoMovimentacao }
  );

  isAjuste = computed(() => this.tipoValue() === 'ajuste' || this.tipoValue() === 'ajuste_saida');

  ngOnInit() {
    this.carregarPagina(1);
    this.produtoService.getAll().subscribe();
    this.categoriaService.getAll().subscribe();
  }

  ngOnDestroy() { this.modal?.dispose(); }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  private buildFiltros(page: number) {
    return {
      DataInicio: this.filterDataInicio() || undefined,
      DataFim: this.filterDataFim() || undefined,
      CategoriaId: this.filterCategoriaId() ?? undefined,
      ProdutoId: this.filterProdutoId() ?? undefined,
      Page: page,
      PageSize: this.pageSize
    };
  }

  totalItems = signal(0);

  carregarPagina(page: number) {
    this.movimentacaoService.getAll(this.buildFiltros(page)).subscribe(result => {
      this.currentPage.set(page);
      this.totalItems.set(result.total);
      this.hasNextPage.set((page * this.pageSize) < result.total);
    });
  }

  aplicarFiltros() { this.carregarPagina(1); }

  limparFiltros() {
    this.filterDataInicio.set('');
    this.filterDataFim.set('');
    this.filterCategoriaId.set(null);
    this.filterProdutoId.set(null);
    this.carregarPagina(1);
  }

  openCreate() {
    this.editingId.set(null);
    this.editingProdutoNome.set('');
    this.form.reset({ tipo: 'entrada', quantidade: 1, valorUnitario: 0, observacao: null, produtoId: null, dataMovimentacao: null, motivoAjuste: null });
    this.f('produtoId').enable();
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(m: Movimentacao) {
    this.editingId.set(m.id);
    this.editingProdutoNome.set(m.produtoNome ?? `Produto #${m.produtoId}`);
    this.form.patchValue({
      produtoId: m.produtoId,
      tipo: m.tipo,
      quantidade: m.quantidade,
      valorUnitario: m.valorUnitario ?? 0,
      dataMovimentacao: m.dataMovimentacao ? m.dataMovimentacao.substring(0, 10) : null,
      observacao: m.observacao ?? null,
      motivoAjuste: m.motivoAjuste ?? null
    });
    this.f('produtoId').disable();
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.getRawValue();
    const id = this.editingId();

    const op = id
      ? this.movimentacaoService.update(id, {
          tipo: val.tipo as TipoMovimentacao,
          quantidade: val.quantidade!,
          valorUnitario: val.valorUnitario!,
          dataMovimentacao: val.dataMovimentacao || null,
          observacao: val.observacao || null,
          motivoAjuste: val.motivoAjuste || null
        } as UpdateMovimentacaoRequest)
      : this.movimentacaoService.create({
          ...val as CreateMovimentacaoRequest,
          dataMovimentacao: val.dataMovimentacao || null,
          motivoAjuste: val.motivoAjuste || null
        });

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.carregarPagina(id ? this.currentPage() : 1);
      },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar movimentação.');
        this.saving.set(false);
      }
    });
  }

  delete(m: Movimentacao) {
    if (!confirm(`Excluir a movimentação #${m.id} (${this.tipoLabel(m.tipo)} — ${m.produtoNome ?? 'Produto #' + m.produtoId})?`)) return;
    this.movimentacaoService.delete(m.id).subscribe({
      error: (err) => alert(err.error?.message ?? 'Erro ao excluir movimentação.')
    });
  }

  motivoLabel(motivo: string): string {
    const map: Record<string, string> = {
      inventario: 'Inventário', quebra: 'Quebra', furto: 'Furto',
      vencimento: 'Vencimento', erro_lancamento: 'Erro lanç.', devolucao: 'Devolução', outro: 'Outro'
    };
    return map[motivo] ?? motivo;
  }

  tipoLabel(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', ajuste_saida: 'Aj. Saída'
    };
    return map[tipo] ?? tipo;
  }

  tipoBadge(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'bg-success', saida: 'bg-danger', ajuste: 'bg-warning text-dark', ajuste_saida: 'bg-secondary'
    };
    return map[tipo] ?? 'bg-secondary';
  }

  f(name: string) { return this.form.get(name)!; }
}
