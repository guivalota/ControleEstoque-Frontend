import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { NotaFiscalService } from '../../core/services/nota-fiscal.service';
import { ProdutoService } from '../../core/services/produto.service';
import { FornecedorService } from '../../core/services/fornecedor.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { NfeService } from '../../core/services/nfe.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { PedidoCompraService } from '../../core/services/pedido-compra.service';
import { PedidoCompra } from '../../core/models/pedido-compra.model';
import { NotaFiscal, TipoNotaFiscal } from '../../core/models/nota-fiscal.model';
import { AnaliseNfeItem, AnaliseNfeResponse, ResolucaoItem } from '../../core/models/nfe.model';

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
  private categoriaService = inject(CategoriaService);
  private nfeService = inject(NfeService);
  private pedidoService = inject(PedidoCompraService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  @ViewChild('detalhesModalEl') detalhesModalEl!: ElementRef;
  @ViewChild('resolucaoModalEl') resolucaoModalEl!: ElementRef;
  private modal!: Modal;
  private detalhesModal!: Modal;
  private resolucaoModal!: Modal;

  notas = this.nfService.notasFiscais;
  produtos = this.produtoService.produtos;
  fornecedores = this.fornecedorService.fornecedores;
  categorias = this.categoriaService.categorias;
  loading = this.nfService.loading;

  importando = signal(false);
  importMsg = signal('');
  analiseResult = signal<AnaliseNfeResponse | null>(null);
  xmlFile = signal<File | null>(null);
  importacaoErro = signal('');
  pedidosAbertos = signal<PedidoCompra[]>([]);

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

  resolucaoForm = this.fb.group({ itens: this.fb.array([]) });

  get itens(): FormArray { return this.form.get('itens') as FormArray; }
  get resolucaoItens(): FormArray { return this.resolucaoForm.get('itens') as FormArray; }

  ngOnInit() {
    this.nfService.getAll().subscribe();
    this.produtoService.getAll().subscribe();
    this.fornecedorService.getAll().subscribe();
    this.categoriaService.getAll().subscribe();
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
    this.importacaoErro.set('');

    this.nfeService.analisar(file).subscribe({
      next: (result) => {
        this.analiseResult.set(result);
        this.xmlFile.set(file);
        this.importando.set(false);
        input.value = '';

        this.resolucaoItens.clear();
        for (const item of result.itens) {
          this.resolucaoItens.push(this.criarResolucaoItemGroup(item));
        }

        this.pedidoService.getAbertos().subscribe({
          next: res => this.pedidosAbertos.set(res.items),
          error: () => {}
        });

        this.importacaoErro.set('');
        this.getResolucaoModal().show();
      },
      error: (err) => {
        this.importMsg.set(err.error?.message ?? 'Erro ao analisar NF-e.');
        this.importando.set(false);
        input.value = '';
      }
    });
  }

  criarResolucaoItemGroup(item: AnaliseNfeItem): FormGroup {
    return this.fb.group({
      itemIndex: [item.itemIndex],
      acao: [item.produtoEncontrado ? 'mapear' : 'criar'],
      produtoId: [item.produtoEncontrado?.id ?? null],
      pedidoCompraItemId: [null as number | null],
      nome: [item.descricaoNF],
      sku: [item.codigoProdutoNF],
      categoriaId: [null as number | null],
      preco: [item.valorUnitario],
      fazParteEstoque: [true]
    });
  }

  pedidoItensParaProduto(produtoId: number | null) {
    if (!produtoId) return [];
    return this.pedidosAbertos().flatMap(p =>
      p.itens
        .filter(i => i.produtoId === +produtoId && i.quantidadeAtendida < i.quantidadeSolicitada)
        .map(i => ({
          id: i.id,
          label: `Pedido #${p.id} — ${p.descricao} (${i.quantidadeSolicitada - i.quantidadeAtendida} restantes)`
        }))
    );
  }

  resolucaoAcao(i: number): string {
    return this.resolucaoItens.at(i).get('acao')?.value ?? 'mapear';
  }

  confirmarImportacao() {
    const itens = this.resolucaoItens.value as any[];

    for (const item of itens) {
      if (item.acao === 'mapear' && !item.produtoId) {
        this.importacaoErro.set('Selecione um produto para todos os itens com ação "Mapear".');
        return;
      }
      if (item.acao === 'criar' && !item.categoriaId) {
        this.importacaoErro.set('Selecione uma categoria para todos os itens com ação "Criar".');
        return;
      }
    }

    const resolucoes: ResolucaoItem[] = itens.map(item => {
      if (item.acao === 'mapear') {
        return {
          itemIndex: item.itemIndex,
          acao: 'mapear' as const,
          produtoId: +item.produtoId,
          ...(item.pedidoCompraItemId ? { pedidoCompraItemId: +item.pedidoCompraItemId } : {})
        };
      }
      return {
        itemIndex: item.itemIndex,
        acao: 'criar' as const,
        categoriaId: +item.categoriaId,
        ...(item.nome ? { nome: item.nome } : {}),
        ...(item.sku ? { sku: item.sku } : {}),
        ...(item.preco != null ? { preco: +item.preco } : {}),
        fazParteEstoque: item.fazParteEstoque ?? true
      };
    });

    this.importando.set(true);
    this.importacaoErro.set('');

    this.nfeService.importar(this.xmlFile()!, resolucoes).subscribe({
      next: (res) => {
        this.importando.set(false);
        this.getResolucaoModal().hide();
        this.analiseResult.set(null);
        this.importMsg.set(`NF-e ${res.numero}/${res.serie} importada! ${res.produtosNovos} produto(s) novo(s) criado(s).`);
        this.nfService.getAll().subscribe();
        this.produtoService.getAll().subscribe();
      },
      error: (err) => {
        this.importacaoErro.set(err.error?.message ?? 'Erro ao importar NF-e.');
        this.importando.set(false);
      }
    });
  }

  cancelarAnalise() {
    this.analiseResult.set(null);
    this.xmlFile.set(null);
    this.importacaoErro.set('');
    this.resolucaoModal?.hide();
  }

  ngOnDestroy() {
    this.modal?.dispose();
    this.detalhesModal?.dispose();
    this.resolucaoModal?.dispose();
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

  private getResolucaoModal(): Modal {
    if (!this.resolucaoModal) this.resolucaoModal = new Modal(this.resolucaoModalEl.nativeElement, { backdrop: 'static' });
    return this.resolucaoModal;
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
  rCtrl(i: number, name: string) { return this.resolucaoItens.at(i).get(name)!; }
}
