import { Component, inject, OnInit, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Modal } from 'bootstrap';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { PermissaoService } from '../../core/services/permissao.service';
import {
  Produto, CreateProdutoRequest, UpdateProdutoRequest, TIPOS_ITEM, TipoItem, rotuloTipoItem
} from '../../core/models/produto.model';
import { QtdPipe, stepDaUnidade } from '../../core/pipes/qtd.pipe';
import { lerErroApi, textoDoErro } from '../../core/utils/erros-api';

@Component({
  selector: 'app-produtos',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, RouterLink, QtdPipe],
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
  unidades = this.produtoService.unidades;
  loading = this.produtoService.loading;
  readonly tipos = TIPOS_ITEM;
  readonly rotuloTipo = rotuloTipoItem;

  searchTerm = signal('');
  tipoFiltro = signal<TipoItem | ''>('');
  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  /** Erro de ações na lista (ex.: excluir variação com movimentação). */
  erroLista = signal('');
  /** Unidade de estoque escolhida no formulário (para o `step` dos campos de quantidade). */
  unidadeEscolhida = signal('un');
  /** Mostra os campos de conversão de compra (rolo -> metros). */
  usaConversao = signal(false);

  filteredProdutos = computed(() => {
    const catMap = new Map(this.categorias().map(c => [c.id, c.nome]));
    const term = this.searchTerm().toLowerCase().trim();
    const tipo = this.tipoFiltro();
    let list = this.produtos().map(p => ({ ...p, categoriaNome: catMap.get(p.categoriaId) ?? '—' }));
    if (tipo) list = list.filter(p => (p.tipoItem ?? 'revenda') === tipo);
    if (!term) return list;
    return list.filter(p => p.nome.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  });

  /** Casas decimais aceitas pela unidade escolhida (0 = só inteiros). */
  casasEscolhidas = computed(() => this.unidades().find(u => u.codigo === this.unidadeEscolhida())?.casasDecimais ?? 0);
  stepQuantidade = computed(() => stepDaUnidade(this.casasEscolhidas()));

  form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(100)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    descricao: ['' as string | null],
    categoriaId: [null as number | null, Validators.required],
    precoUnitario: [0, [Validators.required, Validators.min(0)]],
    estoqueMinimo: [null as number | null, Validators.min(0)],
    pontoReposicao: [null as number | null, Validators.min(0)],
    fazParteEstoque: [true],
    ativo: [true],
    tipoItem: ['revenda' as TipoItem, Validators.required],
    unidadeCodigo: ['un', Validators.required],
    unidadeCompraCodigo: [null as string | null],
    fatorConversao: [null as number | null, Validators.min(0.000001)]
  });

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.produtoService.getUnidades().subscribe();
    this.categoriaService.getAll().subscribe();
    this.form.controls.unidadeCodigo.valueChanges.subscribe(v => this.unidadeEscolhida.set(v ?? 'un'));
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
    this.form.reset({
      ativo: true, precoUnitario: 0, descricao: null, estoqueMinimo: null, pontoReposicao: null, fazParteEstoque: true,
      tipoItem: 'revenda', unidadeCodigo: 'un', unidadeCompraCodigo: null, fatorConversao: null
    });
    this.unidadeEscolhida.set('un');
    this.usaConversao.set(false);
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(p: Produto) {
    this.editingId.set(p.id);
    this.form.patchValue({
      ...p,
      descricao: p.descricao ?? null,
      estoqueMinimo: p.estoqueMinimo ?? null,
      pontoReposicao: p.pontoReposicao ?? null,
      tipoItem: p.tipoItem ?? 'revenda',
      unidadeCodigo: p.unidadeCodigo ?? 'un',
      unidadeCompraCodigo: p.unidadeCompraCodigo ?? null,
      fatorConversao: p.fatorConversao ?? null
    });
    this.unidadeEscolhida.set(p.unidadeCodigo ?? 'un');
    this.usaConversao.set(!!p.unidadeCompraCodigo);
    this.saveError.set('');
    this.getModal().show();
  }

  /** Liga ou desliga a conversão de compra; ao desligar, limpa os dois campos (o back remove com texto vazio). */
  alternarConversao(ligada: boolean) {
    this.usaConversao.set(ligada);
    if (!ligada) this.form.patchValue({ unidadeCompraCodigo: null, fatorConversao: null });
  }

  /** Monta o corpo da requisição: sem conversão, cria sem os campos e edita enviando texto vazio (remove). */
  montarPayload(editando: boolean): CreateProdutoRequest | UpdateProdutoRequest {
    const v = this.form.getRawValue();
    const compra = this.usaConversao() && v.unidadeCompraCodigo ? v.unidadeCompraCodigo : null;
    const base = {
      sku: v.sku, nome: v.nome, descricao: v.descricao, categoriaId: v.categoriaId,
      precoUnitario: v.precoUnitario, estoqueMinimo: v.estoqueMinimo ?? 0, pontoReposicao: v.pontoReposicao ?? 0,
      fazParteEstoque: v.fazParteEstoque, tipoItem: v.tipoItem, unidadeCodigo: v.unidadeCodigo
    };
    if (editando) {
      return { ...base, ativo: v.ativo, unidadeCompraCodigo: compra ?? '', fatorConversao: compra ? v.fatorConversao : null } as UpdateProdutoRequest;
    }
    return { ...base, unidadeCompraCodigo: compra, fatorConversao: compra ? v.fatorConversao : null } as CreateProdutoRequest;
  }

  save() {
    if (this.usaConversao() && (!this.form.value.unidadeCompraCodigo || !this.form.value.fatorConversao)) {
      this.saveError.set('Informe a unidade de compra e o fator de conversão.');
      return;
    }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const id = this.editingId();
    const op = id
      ? this.produtoService.update(id, this.montarPayload(true) as UpdateProdutoRequest)
      : this.produtoService.create(this.montarPayload(false) as CreateProdutoRequest);

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(textoDoErro(lerErroApi(err, 'Erro ao salvar produto.'), 'Erro ao salvar produto.'));
        this.saving.set(false);
      }
    });
  }

  delete(p: Produto) {
    if (!confirm(`Excluir o produto "${p.nome}"?`)) return;
    this.produtoService.delete(p.id).subscribe({
      next: () => this.erroLista.set(''),
      error: (err) => this.erroLista.set(textoDoErro(lerErroApi(err, 'Não foi possível excluir o produto.'), 'Não foi possível excluir o produto.'))
    });
  }

  f(name: string) { return this.form.get(name)!; }
}
