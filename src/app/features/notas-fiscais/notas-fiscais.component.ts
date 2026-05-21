import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { NotaFiscalService } from '../../core/services/nota-fiscal.service';
import { ProdutoService } from '../../core/services/produto.service';
import { FornecedorService } from '../../core/services/fornecedor.service';
import { NfeService } from '../../core/services/nfe.service';
import { PermissaoService } from '../../core/services/permissao.service';
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
  fornecedorService = inject(FornecedorService);
  private nfeService = inject(NfeService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  @ViewChild('detalhesModalEl') detalhesModalEl!: ElementRef;
  private modal!: Modal;
  private detalhesModal!: Modal;

  notas = this.nfService.notasFiscais;
  produtos = this.produtoService.produtos;
  fornecedores = this.fornecedorService.fornecedores;
  loading = this.nfService.loading;
  importando = signal(false);
  importMsg = signal('');

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
    fornecedorId: [null as number | null],
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
    this.fornecedorService.getAll().subscribe();
  }

  selecionarFornecedor(id: number | null) {
    this.form.patchValue({ fornecedorId: id });
    if (!id) return;
    const f = this.fornecedores().find(f => f.id === id);
    if (f) this.form.patchValue({ fornecedorNome: f.razaoSocial, fornecedorCnpj: f.cnpj });
  }

  importarXml(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importando.set(true);
    this.importMsg.set('');
    this.nfeService.importar(file).subscribe({
      next: () => {
        this.importMsg.set('NF-e importada com sucesso!');
        this.nfService.getAll().subscribe();
        this.importando.set(false);
        input.value = '';
      },
      error: (err) => {
        this.importMsg.set(err.error?.message ?? 'Erro ao importar NF-e.');
        this.importando.set(false);
        input.value = '';
      }
    });
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
    const prodMap = new Map(this.produtos().map(p => [p.id, p.nome]));
    this.nfService.getMovimentacoes(nf.id).subscribe(movs =>
      this.movimentacoesNF.set(movs.map(m => ({ ...m, produtoNome: m.produtoNome ?? prodMap.get(m.produtoId) })))
    );
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
