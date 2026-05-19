import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { NotaFiscalService } from '../../core/services/nota-fiscal.service';
import { ProdutoService } from '../../core/services/produto.service';
import { NotaFiscal, TipoNotaFiscal } from '../../core/models/nota-fiscal.model';

@Component({
  selector: 'app-notas-fiscais',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, DatePipe, TitleCasePipe],
  templateUrl: './notas-fiscais.component.html'
})
export class NotasFiscaisComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  nfService = inject(NotaFiscalService);
  produtoService = inject(ProdutoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  @ViewChild('detalhesModalEl') detalhesModalEl!: ElementRef;
  private modal!: Modal;
  private detalhesModal!: Modal;

  notas = this.nfService.notasFiscais;
  produtos = this.produtoService.produtos;
  loading = this.nfService.loading;

  saving = signal(false);
  saveError = signal('');
  notaSelecionada = signal<NotaFiscal | null>(null);
  movimentacoesNF = signal<any[]>([]);

  valorTotalComputado = computed(() => {
    return this.itens.controls.reduce((sum, ctrl) => {
      const qtd = ctrl.get('quantidade')?.value ?? 0;
      const val = ctrl.get('valorUnitario')?.value ?? 0;
      return sum + (qtd * val);
    }, 0);
  });

  form = this.fb.group({
    numero: ['', [Validators.required, Validators.maxLength(50)]],
    serie: ['1', [Validators.required, Validators.maxLength(10)]],
    tipo: ['entrada' as TipoNotaFiscal, Validators.required],
    fornecedorNome: ['', [Validators.required, Validators.maxLength(255)]],
    fornecedorCnpj: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
    dataEmissao: ['', Validators.required],
    observacao: ['' as string | null],
    itens: this.fb.array([this.criarItemGroup()])
  });

  get itens(): FormArray {
    return this.form.get('itens') as FormArray;
  }

  ngOnInit() {
    this.nfService.getAll().subscribe();
    this.produtoService.getAll().subscribe();
  }

  ngOnDestroy() {
    this.modal?.dispose();
    this.detalhesModal?.dispose();
  }

  criarItemGroup() {
    return this.fb.group({
      produtoId: [null as number | null, Validators.required],
      quantidade: [1, [Validators.required, Validators.min(1)]],
      valorUnitario: [0, [Validators.required, Validators.min(0)]],
      observacao: ['' as string | null]
    });
  }

  addItem() { this.itens.push(this.criarItemGroup()); }
  removeItem(i: number) { if (this.itens.length > 1) this.itens.removeAt(i); }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  private getDetalhesModal(): Modal {
    if (!this.detalhesModal) this.detalhesModal = new Modal(this.detalhesModalEl.nativeElement);
    return this.detalhesModal;
  }

  openCreate() {
    while (this.itens.length > 1) this.itens.removeAt(1);
    this.form.reset({ tipo: 'entrada', serie: '1' });
    this.itens.at(0).reset({ quantidade: 1, valorUnitario: 0 });
    this.saveError.set('');
    this.getModal().show();
  }

  verDetalhes(nf: NotaFiscal) {
    this.notaSelecionada.set(nf);
    this.movimentacoesNF.set([]);
    this.nfService.getMovimentacoes(nf.id).subscribe(movs => this.movimentacoesNF.set(movs));
    this.getDetalhesModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.value;
    const req = { ...val, valorTotal: this.valorTotalComputado(), itens: val.itens } as any;

    this.nfService.create(req).subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar nota fiscal.');
        this.saving.set(false);
      }
    });
  }

  tipoBadge(tipo: TipoNotaFiscal): string {
    return tipo === 'entrada' ? 'bg-success' : 'bg-danger';
  }

  statusBadge(status: string): string {
    return status === 'processada' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning';
  }

  f(name: string) { return this.form.get(name)!; }
  itemCtrl(i: number, name: string) { return this.itens.at(i).get(name)!; }
}
