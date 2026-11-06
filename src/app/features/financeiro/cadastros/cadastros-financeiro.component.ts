import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { PodeDirective } from '../../../shared/permissao/pode.directive';
import { FinanceiroRelatoriosService } from '../../../core/services/financeiro-relatorios.service';
import { FinConfiguracao } from '../../../core/models/financeiro-relatorios.model';
import {
  CategoriaFin, CentroCustoFin, ContaFin, MAX_NIVEIS_CATEGORIA, NaturezaCategoria, ROTULO_NATUREZA, ROTULO_TIPO_CONTA,
  TipoConta, montarArvoreCategorias
} from '../../../core/models/financeiro-cadastros.model';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

type Aba = 'contas' | 'categorias' | 'centros' | 'config';

/**
 * Cadastros do Financeiro (US-24-02): contas (caixa/banco), plano de categorias em árvore (até 3 níveis) e centros de custo.
 * Quem tem `financeiro.cadastros.ver` consulta; só quem tem `financeiro.cadastros.editar` vê os botões de escrita.
 * Excluir pode ser recusado pelo servidor (itens vinculados): a tela sugere inativar.
 */
@Component({
  selector: 'app-cadastros-financeiro',
  standalone: true,
  imports: [ReactiveFormsModule, PodeDirective],
  template: `
    <h1 class="h4 mb-3">Cadastros do financeiro</h1>
    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (a of abas; track a.id) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="aba() === a.id" [attr.aria-selected]="aba() === a.id"
                  (click)="trocarAba(a.id)">{{ a.rotulo }}</button>
        </li>
      }
    </ul>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <!-- ===================================================== CONTAS -->
    @if (aba() === 'contas') {
      <div class="d-flex justify-content-between align-items-center mb-2">
        <p class="text-secondary small mb-0">Caixas e bancos da empresa. O saldo inicial é o ponto de partida do fluxo de caixa.</p>
        <button *appPode="'financeiro.cadastros.editar'" type="button" class="btn btn-primary btn-sm" (click)="novaConta()">
          <i class="bi bi-plus-lg me-1"></i>Nova conta
        </button>
      </div>
      @if (editando() === 'conta') {
        <form class="card card-body mb-3" [formGroup]="formConta" (submit)="$event.preventDefault(); salvarConta()">
          <div class="row g-2">
            <div class="col-12 col-md-4">
              <label class="form-label" for="ctNome">Nome</label>
              <input id="ctNome" class="form-control" formControlName="nome" maxlength="120" [class.is-invalid]="invalido(formConta, 'nome')">
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label" for="ctTipo">Tipo</label>
              <select id="ctTipo" class="form-select" formControlName="tipo">
                <option value="caixa">Caixa</option><option value="banco">Banco</option>
              </select>
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label" for="ctSaldo">Saldo inicial (R$)</label>
              <input id="ctSaldo" type="number" step="0.01" class="form-control" formControlName="saldoInicial">
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="ctData">Saldo em</label>
              <input id="ctData" type="date" class="form-control" formControlName="dataSaldoInicial">
            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Salvar</button>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="cancelar()">Cancelar</button>
          </div>
        </form>
      }
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Nome</th><th>Tipo</th><th class="text-end">Saldo inicial</th><th>Em</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            @for (c of contas(); track c.id) {
              <tr>
                <td>{{ c.nome }}</td><td>{{ rotuloTipo(c.tipo) }}</td>
                <td class="text-end">{{ moeda(c.saldoInicial) }}</td><td>{{ data(c.dataSaldoInicial) }}</td>
                <td><span class="badge" [class.text-bg-success]="c.ativo" [class.text-bg-secondary]="!c.ativo">{{ c.ativo ? 'Ativa' : 'Inativa' }}</span></td>
                <td class="text-end text-nowrap">
                  <ng-container *appPode="'financeiro.cadastros.editar'">
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="'Editar ' + c.nome" (click)="editarConta(c)"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="(c.ativo ? 'Inativar ' : 'Ativar ') + c.nome" (click)="alternarConta(c)">{{ c.ativo ? 'Inativar' : 'Ativar' }}</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Excluir ' + c.nome" (click)="excluirConta(c)"><i class="bi bi-trash"></i></button>
                  </ng-container>
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhuma conta cadastrada.' }}</td></tr> }
          </tbody>
        </table>
      </div>
    }

    <!-- ================================================= CATEGORIAS -->
    @if (aba() === 'categorias') {
      <div class="d-flex justify-content-between align-items-center mb-2">
        <p class="text-secondary small mb-0">Plano gerencial em até {{ maxNiveis }} níveis. A subcategoria herda a natureza (receita ou despesa) da categoria pai.</p>
        <button *appPode="'financeiro.cadastros.editar'" type="button" class="btn btn-primary btn-sm" (click)="novaCategoria(null)">
          <i class="bi bi-plus-lg me-1"></i>Nova categoria
        </button>
      </div>
      @if (editando() === 'categoria') {
        <form class="card card-body mb-3" [formGroup]="formCategoria" (submit)="$event.preventDefault(); salvarCategoria()">
          <div class="row g-2">
            <div class="col-12 col-md-5">
              <label class="form-label" for="caNome">Nome</label>
              <input id="caNome" class="form-control" formControlName="nome" maxlength="120" [class.is-invalid]="invalido(formCategoria, 'nome')">
            </div>
            @if (idEdicao() === null) {
              <div class="col-12 col-md-4">
                <label class="form-label" for="caPai">Categoria pai</label>
                <select id="caPai" class="form-select" formControlName="paiId" (change)="aoTrocarPai()">
                  <option [ngValue]="null">— nenhuma (raiz) —</option>
                  @for (p of possiveisPais(); track p.categoria.id) {
                    <option [ngValue]="p.categoria.id">{{ recuo(p.nivel) }}{{ p.categoria.nome }}</option>
                  }
                </select>
              </div>
              <div class="col-12 col-md-3">
                <label class="form-label" for="caNat">Natureza</label>
                <select id="caNat" class="form-select" formControlName="natureza">
                  <option value="despesa">Despesa</option><option value="receita">Receita</option>
                </select>
              </div>
            }
          </div>
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Salvar</button>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="cancelar()">Cancelar</button>
          </div>
        </form>
      }
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Categoria</th><th>Natureza</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            @for (n of arvore(); track n.categoria.id) {
              <tr>
                <td><span class="text-secondary">{{ recuo(n.nivel) }}</span>{{ n.categoria.nome }}</td>
                <td>{{ rotuloNatureza(n.categoria.natureza) }}</td>
                <td><span class="badge" [class.text-bg-success]="n.categoria.ativo" [class.text-bg-secondary]="!n.categoria.ativo">{{ n.categoria.ativo ? 'Ativa' : 'Inativa' }}</span></td>
                <td class="text-end text-nowrap">
                  <ng-container *appPode="'financeiro.cadastros.editar'">
                    @if (n.categoria.nivel < maxNiveis && n.categoria.ativo) {
                      <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="'Nova subcategoria de ' + n.categoria.nome" (click)="novaCategoria(n.categoria)"><i class="bi bi-diagram-2"></i></button>
                    }
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="'Editar ' + n.categoria.nome" (click)="editarCategoria(n.categoria)"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="(n.categoria.ativo ? 'Inativar ' : 'Ativar ') + n.categoria.nome" (click)="alternarCategoria(n.categoria)">{{ n.categoria.ativo ? 'Inativar' : 'Ativar' }}</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Excluir ' + n.categoria.nome" (click)="excluirCategoria(n.categoria)"><i class="bi bi-trash"></i></button>
                  </ng-container>
                </td>
              </tr>
            } @empty { <tr><td colspan="4" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhuma categoria cadastrada.' }}</td></tr> }
          </tbody>
        </table>
      </div>
    }

    <!-- ================================================== CONFIGURAÇÕES -->
    @if (aba() === 'config') {
      <p class="text-secondary small">Só quem tem a permissão de configurar a aprovação altera estes valores.</p>
      <form class="card card-body" [formGroup]="formConfig" (submit)="$event.preventDefault(); salvarConfig()">
        <div class="row g-3">
          <div class="col-12 col-md-4">
            <label class="form-label" for="cfMin">Exigir aprovação de pagamentos a partir de (R$)</label>
            <input id="cfMin" type="number" step="0.01" min="0" class="form-control" formControlName="aprovacaoValorMinimo">
            <div class="form-text">Título a pagar com valor igual ou acima disso só é baixado depois de aprovado por <strong>outro</strong> administrador. Zero desliga.</div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="cfPrazo">Prazo padrão de vencimento (dias)</label>
            <input id="cfPrazo" type="number" min="0" max="365" class="form-control" formControlName="prazoPadraoDias">
            <div class="form-text">Para notas e retornos que chegam do Estoque e da Produção sem data de vencimento: emissão + este prazo.</div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="cfCat">Categoria dos pagamentos importados</label>
            <select id="cfCat" class="form-select" formControlName="categoriaPadraoPagarId">
              <option [ngValue]="null">“Importados” (criada sozinha)</option>
              @for (c of categoriasDespesa(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="cfHor">Contas fixas: gerar até quantos meses à frente</label>
            <input id="cfHor" type="number" min="1" max="24" class="form-control" formControlName="recorrenciaHorizonteMeses">
          </div>
        </div>
        <div class="mt-3" *appPode="'financeiro.aprovacao.configurar'">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Salvar configurações</button>
        </div>
      </form>
    }

    <!-- ================================================ CENTROS DE CUSTO -->
    @if (aba() === 'centros') {
      <div class="d-flex justify-content-between align-items-center mb-2">
        <p class="text-secondary small mb-0">Agrupam os lançamentos por área ou projeto (opcional em cada título).</p>
        <button *appPode="'financeiro.cadastros.editar'" type="button" class="btn btn-primary btn-sm" (click)="novoCentro()">
          <i class="bi bi-plus-lg me-1"></i>Novo centro de custo
        </button>
      </div>
      @if (editando() === 'centro') {
        <form class="card card-body mb-3" [formGroup]="formCentro" (submit)="$event.preventDefault(); salvarCentro()">
          <div class="row g-2">
            <div class="col-12 col-md-6">
              <label class="form-label" for="ccNome">Nome</label>
              <input id="ccNome" class="form-control" formControlName="nome" maxlength="120" [class.is-invalid]="invalido(formCentro, 'nome')">
            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Salvar</button>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="cancelar()">Cancelar</button>
          </div>
        </form>
      }
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Nome</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            @for (c of centros(); track c.id) {
              <tr>
                <td>{{ c.nome }}</td>
                <td><span class="badge" [class.text-bg-success]="c.ativo" [class.text-bg-secondary]="!c.ativo">{{ c.ativo ? 'Ativo' : 'Inativo' }}</span></td>
                <td class="text-end text-nowrap">
                  <ng-container *appPode="'financeiro.cadastros.editar'">
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="'Editar ' + c.nome" (click)="editarCentro(c)"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="(c.ativo ? 'Inativar ' : 'Ativar ') + c.nome" (click)="alternarCentro(c)">{{ c.ativo ? 'Inativar' : 'Ativar' }}</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Excluir ' + c.nome" (click)="excluirCentro(c)"><i class="bi bi-trash"></i></button>
                  </ng-container>
                </td>
              </tr>
            } @empty { <tr><td colspan="3" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhum centro de custo cadastrado.' }}</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `
})
export class CadastrosFinanceiroComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(FinanceiroCadastrosService);
  private toast = inject(ToastService);
  private relatorios = inject(FinanceiroRelatoriosService);
  permissao = inject(PermissaoService);

  readonly abas: { id: Aba; rotulo: string }[] = [
    { id: 'contas', rotulo: 'Contas' }, { id: 'categorias', rotulo: 'Categorias' }, { id: 'centros', rotulo: 'Centros de custo' },
    { id: 'config', rotulo: 'Configurações' }
  ];
  readonly maxNiveis = MAX_NIVEIS_CATEGORIA;

  aba = signal<Aba>('contas');
  contas = signal<ContaFin[]>([]);
  categorias = signal<CategoriaFin[]>([]);
  centros = signal<CentroCustoFin[]>([]);
  carregando = signal(false);
  erro = signal('');
  salvando = signal(false);
  editando = signal<'conta' | 'categoria' | 'centro' | null>(null);
  idEdicao = signal<number | null>(null);

  arvore = computed(() => montarArvoreCategorias(this.categorias()));
  /** Pais possíveis: ativas e que ainda aceitam filhas (abaixo do último nível). */
  possiveisPais = computed(() => this.arvore().filter(n => n.categoria.ativo && n.categoria.nivel < MAX_NIVEIS_CATEGORIA));

  formConta = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    tipo: ['caixa' as TipoConta, Validators.required],
    saldoInicial: [0, Validators.required],
    dataSaldoInicial: ['']
  });
  formCategoria = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    paiId: [null as number | null],
    natureza: ['despesa' as NaturezaCategoria]
  });
  formCentro = this.fb.nonNullable.group({ nome: ['', [Validators.required, Validators.maxLength(120)]] });
  formConfig = this.fb.group({
    aprovacaoValorMinimo: [0, [Validators.required, Validators.min(0)]],
    prazoPadraoDias: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
    categoriaPadraoPagarId: [null as number | null],
    recorrenciaHorizonteMeses: [3, [Validators.required, Validators.min(1), Validators.max(24)]]
  });
  categoriasDespesa = computed(() => this.categorias().filter(c => c.natureza === 'despesa' && c.ativo));

  ngOnInit() { this.carregar('contas'); }

  trocarAba(aba: Aba) {
    this.aba.set(aba);
    this.cancelar();
    this.carregar(aba);
  }

  private carregar(aba: Aba) {
    this.carregando.set(true);
    this.erro.set('');
    const fim = { error: (e: unknown) => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar.'), 'Não foi possível carregar.')); } };
    if (aba === 'contas') this.service.contas().subscribe({ next: l => { this.contas.set(l); this.carregando.set(false); }, ...fim });
    else if (aba === 'categorias') this.service.categorias().subscribe({ next: l => { this.categorias.set(l); this.carregando.set(false); }, ...fim });
    else if (aba === 'centros') this.service.centros().subscribe({ next: l => { this.centros.set(l); this.carregando.set(false); }, ...fim });
    else {
      this.service.categorias().subscribe({ next: l => this.categorias.set(l), error: () => undefined });
      this.relatorios.configuracao().subscribe({ next: c => { this.aplicarConfig(c); this.carregando.set(false); }, ...fim });
    }
  }

  cancelar() { this.editando.set(null); this.idEdicao.set(null); }

  invalido(form: { get(n: string): { invalid: boolean; touched: boolean } | null }, campo: string) {
    const c = form.get(campo);
    return !!c && c.invalid && c.touched;
  }

  rotuloTipo(t: TipoConta) { return ROTULO_TIPO_CONTA[t] ?? t; }
  rotuloNatureza(n: NaturezaCategoria) { return ROTULO_NATUREZA[n] ?? n; }
  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }
  recuo(nivel: number) { return '— '.repeat(nivel); }

  /** Executa a chamada de gravação/exclusão mostrando o aviso e recarregando a aba. */
  private executar(op: Observable<unknown>, aba: Aba, ok: string, falha: string, dicaInativar = false) {
    this.salvando.set(true);
    op.subscribe({
      next: () => { this.salvando.set(false); this.cancelar(); this.toast.sucesso(ok); this.carregar(aba); },
      error: (e: unknown) => {
        this.salvando.set(false);
        const msg = textoDoErro(lerErroApi(e, falha), falha);
        this.toast.erro(dicaInativar ? `${msg} Você pode inativar em vez de excluir.` : msg);
      }
    });
  }

  // ---- contas
  novaConta() { this.formConta.reset({ nome: '', tipo: 'caixa', saldoInicial: 0, dataSaldoInicial: '' }); this.idEdicao.set(null); this.editando.set('conta'); }
  editarConta(c: ContaFin) {
    this.formConta.reset({ nome: c.nome, tipo: c.tipo, saldoInicial: c.saldoInicial, dataSaldoInicial: c.dataSaldoInicial });
    this.idEdicao.set(c.id); this.editando.set('conta');
  }
  salvarConta() {
    if (this.formConta.invalid) { this.formConta.markAllAsTouched(); return; }
    const v = this.formConta.getRawValue();
    const corpo = { nome: v.nome.trim(), tipo: v.tipo, saldoInicial: Number(v.saldoInicial), dataSaldoInicial: v.dataSaldoInicial || null };
    const id = this.idEdicao();
    this.executar(id === null ? this.service.criarConta(corpo) : this.service.atualizarConta(id, corpo), 'contas', 'Conta salva.', 'Não foi possível salvar a conta.');
  }
  alternarConta(c: ContaFin) {
    this.executar(this.service.atualizarConta(c.id, { ativo: !c.ativo }), 'contas', c.ativo ? 'Conta inativada.' : 'Conta ativada.', 'Não foi possível alterar a conta.');
  }
  excluirConta(c: ContaFin) {
    if (!confirm(`Excluir a conta "${c.nome}"?`)) return;
    this.executar(this.service.excluirConta(c.id), 'contas', 'Conta excluída.', 'Não foi possível excluir a conta.', true);
  }

  // ---- categorias
  novaCategoria(pai: CategoriaFin | null) {
    this.formCategoria.reset({ nome: '', paiId: pai?.id ?? null, natureza: pai?.natureza ?? 'despesa' });
    this.formCategoria.controls.natureza[pai ? 'disable' : 'enable']();
    this.idEdicao.set(null); this.editando.set('categoria');
  }
  editarCategoria(c: CategoriaFin) {
    this.formCategoria.reset({ nome: c.nome, paiId: c.paiId, natureza: c.natureza });
    this.idEdicao.set(c.id); this.editando.set('categoria');
  }
  /** Filha usa a natureza do pai: o seletor trava e acompanha o pai escolhido. */
  aoTrocarPai() {
    const paiId = this.formCategoria.controls.paiId.value;
    const pai = this.categorias().find(c => c.id === paiId);
    if (pai) { this.formCategoria.controls.natureza.setValue(pai.natureza); this.formCategoria.controls.natureza.disable(); }
    else this.formCategoria.controls.natureza.enable();
  }
  salvarCategoria() {
    if (this.formCategoria.invalid) { this.formCategoria.markAllAsTouched(); return; }
    const v = this.formCategoria.getRawValue();
    const id = this.idEdicao();
    const op = id === null
      ? this.service.criarCategoria({ nome: (v.nome ?? '').trim(), paiId: v.paiId, natureza: v.paiId ? null : v.natureza })
      : this.service.atualizarCategoria(id, { nome: (v.nome ?? '').trim() });
    this.executar(op, 'categorias', 'Categoria salva.', 'Não foi possível salvar a categoria.');
  }
  alternarCategoria(c: CategoriaFin) {
    this.executar(this.service.atualizarCategoria(c.id, { ativo: !c.ativo }), 'categorias', c.ativo ? 'Categoria inativada.' : 'Categoria ativada.', 'Não foi possível alterar a categoria.');
  }
  excluirCategoria(c: CategoriaFin) {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    this.executar(this.service.excluirCategoria(c.id), 'categorias', 'Categoria excluída.', 'Não foi possível excluir a categoria.', true);
  }

  // ---- configurações
  private aplicarConfig(c: FinConfiguracao) {
    this.formConfig.reset({
      aprovacaoValorMinimo: c.aprovacaoValorMinimo, prazoPadraoDias: c.prazoPadraoDias,
      categoriaPadraoPagarId: c.categoriaPadraoPagarId, recorrenciaHorizonteMeses: c.recorrenciaHorizonteMeses
    });
    if (!this.permissao.pode('financeiro.aprovacao.configurar')) this.formConfig.disable();
  }
  salvarConfig() {
    if (this.formConfig.invalid) { this.formConfig.markAllAsTouched(); return; }
    const v = this.formConfig.getRawValue();
    this.executar(this.relatorios.salvarConfiguracao({
      aprovacaoValorMinimo: Number(v.aprovacaoValorMinimo), prazoPadraoDias: Number(v.prazoPadraoDias),
      categoriaPadraoPagarId: v.categoriaPadraoPagarId, recorrenciaHorizonteMeses: Number(v.recorrenciaHorizonteMeses)
    }), 'config', 'Configurações salvas.', 'Não foi possível salvar as configurações.');
  }

  // ---- centros de custo
  novoCentro() { this.formCentro.reset({ nome: '' }); this.idEdicao.set(null); this.editando.set('centro'); }
  editarCentro(c: CentroCustoFin) { this.formCentro.reset({ nome: c.nome }); this.idEdicao.set(c.id); this.editando.set('centro'); }
  salvarCentro() {
    if (this.formCentro.invalid) { this.formCentro.markAllAsTouched(); return; }
    const nome = this.formCentro.getRawValue().nome.trim();
    const id = this.idEdicao();
    this.executar(id === null ? this.service.criarCentro({ nome }) : this.service.atualizarCentro(id, { nome }), 'centros', 'Centro de custo salvo.', 'Não foi possível salvar o centro de custo.');
  }
  alternarCentro(c: CentroCustoFin) {
    this.executar(this.service.atualizarCentro(c.id, { ativo: !c.ativo }), 'centros', c.ativo ? 'Centro inativado.' : 'Centro ativado.', 'Não foi possível alterar o centro de custo.');
  }
  excluirCentro(c: CentroCustoFin) {
    if (!confirm(`Excluir o centro de custo "${c.nome}"?`)) return;
    this.executar(this.service.excluirCentro(c.id), 'centros', 'Centro de custo excluído.', 'Não foi possível excluir o centro de custo.', true);
  }
}
