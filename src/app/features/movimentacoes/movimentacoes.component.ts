import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { ProdutoService } from '../../core/services/produto.service';
import { CreateMovimentacaoRequest, TipoMovimentacao } from '../../core/models/movimentacao.model';

@Component({
  selector: 'app-movimentacoes',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TitleCasePipe],
  templateUrl: './movimentacoes.component.html'
})
export class MovimentacoesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  movimentacaoService = inject(MovimentacaoService);
  produtoService = inject(ProdutoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  movimentacoes = this.movimentacaoService.movimentacoes;
  produtos = this.produtoService.produtos;
  loading = this.movimentacaoService.loading;

  filterProdutoId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  filteredMovimentacoes = computed(() => {
    const prodMap = new Map(this.produtos().map(p => [p.id, p.nome]));
    const id = this.filterProdutoId();
    const list = [...this.movimentacoes()]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .map(m => ({ ...m, produtoNome: prodMap.get(m.produtoId) }));
    return id ? list.filter(m => m.produtoId === id) : list;
  });

  form = this.fb.group({
    produtoId: [null as number | null, Validators.required],
    tipo: ['entrada' as TipoMovimentacao, Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    valorUnitario: [0, [Validators.required, Validators.min(0)]],
    observacao: ['' as string | null]
  });

  ngOnInit() {
    this.movimentacaoService.getAll().subscribe();
    this.produtoService.getAll().subscribe();
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  openCreate() {
    this.form.reset({ tipo: 'entrada', quantidade: 1, valorUnitario: 0, observacao: null, produtoId: null });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    this.movimentacaoService.create(this.form.value as CreateMovimentacaoRequest).subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao registrar movimentação.');
        this.saving.set(false);
      }
    });
  }

  tipoBadge(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'bg-success',
      saida: 'bg-danger',
      ajuste: 'bg-warning text-dark'
    };
    return map[tipo] ?? 'bg-secondary';
  }

  f(name: string) { return this.form.get(name)!; }
}
