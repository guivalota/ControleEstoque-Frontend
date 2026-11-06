import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FinanceiroTitulosService } from '../../../core/services/financeiro-titulos.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { ClienteService } from '../../../core/services/cliente.service';
import { ToastService } from '../../../core/services/toast.service';
import { PodeDirective } from '../../../shared/permissao/pode.directive';
import { CategoriaFin, CentroCustoFin } from '../../../core/models/financeiro-cadastros.model';
import { ROTULO_TIPO_TITULO, Recorrencia, TipoTitulo } from '../../../core/models/financeiro-titulos.model';
import { hojeIso } from '../../../core/utils/financeiro-datas';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/**
 * Contas fixas (US-24-09): aluguel, assinatura, mensalidade. Cada uma gera um título por mês até o horizonte configurado,
 * sem duplicar. Alterar vale só para os próximos títulos; encerrar não apaga os já gerados.
 */
@Component({
  selector: 'app-contas-fixas',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PodeDirective],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h4 mb-0">Contas fixas</h1>
      <button *appPode="'financeiro.titulos.criar'" type="button" class="btn btn-primary btn-sm" (click)="nova()"><i class="bi bi-plus-lg me-1"></i>Nova conta fixa</button>
    </div>
    <p class="text-secondary small">Gera um título por mês, com vencimento no mesmo dia (em mês mais curto, no último dia). Mudanças valem para os próximos títulos.</p>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (editando() !== null) {
      <form class="card card-body mb-3" [formGroup]="form" (submit)="$event.preventDefault(); salvar()">
        <h2 class="h6">{{ editando() === 0 ? 'Nova conta fixa' : 'Alterar conta fixa' }}</h2>
        <div class="row g-2">
          @if (editando() === 0) {
            <div class="col-12">
              <div class="btn-group" role="group" aria-label="Tipo">
                @for (t of tipos; track t.valor) {
                  <input type="radio" class="btn-check" formControlName="tipo" [value]="t.valor" [id]="'rt-' + t.valor" (change)="form.patchValue({ pessoaId: 0, categoriaId: null })">
                  <label class="btn btn-outline-primary btn-sm" [for]="'rt-' + t.valor">{{ t.rotulo }}</label>
                }
              </div>
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="rPessoa">{{ form.controls.tipo.value === 'pagar' ? 'Fornecedor' : 'Cliente' }}</label>
              <select id="rPessoa" class="form-select" formControlName="pessoaId">
                <option [ngValue]="0">Outro (digitar o nome)</option>
                @for (p of pessoas(); track p.id) { <option [ngValue]="p.id">{{ p.nome }}</option> }
              </select>
            </div>
            @if (form.controls.pessoaId.value === 0) {
              <div class="col-12 col-md-4"><label class="form-label" for="rNome">Nome</label><input id="rNome" class="form-control" formControlName="pessoaNome" maxlength="200"></div>
            }
          }
          <div class="col-12 col-md-4"><label class="form-label" for="rDesc">Descrição</label><input id="rDesc" class="form-control" formControlName="descricao" maxlength="255" [class.is-invalid]="inv('descricao')"></div>
          <div class="col-6 col-md-2"><label class="form-label" for="rDoc">Documento</label><input id="rDoc" class="form-control" formControlName="documento" maxlength="60"></div>
          <div class="col-6 col-md-2"><label class="form-label" for="rValor">Valor (R$)</label><input id="rValor" type="number" step="0.01" min="0.01" class="form-control" formControlName="valor" [class.is-invalid]="inv('valor')"></div>
          <div class="col-6 col-md-2"><label class="form-label" for="rDia">Dia do vencimento</label><input id="rDia" type="number" min="1" max="31" class="form-control" formControlName="diaVencimento" [class.is-invalid]="inv('diaVencimento')"></div>
          <div class="col-6 col-md-3">
            <label class="form-label" for="rCat">Categoria</label>
            <select id="rCat" class="form-select" formControlName="categoriaId" [class.is-invalid]="inv('categoriaId')">
              <option [ngValue]="null" disabled>Escolha…</option>
              @for (c of categoriasDoTipo(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label" for="rCen">Centro de custo</label>
            <select id="rCen" class="form-select" formControlName="centroCustoId"><option [ngValue]="null">Nenhum</option>@for (c of centros(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }</select>
          </div>
          @if (editando() === 0) {
            <div class="col-6 col-md-2"><label class="form-label" for="rIni">Começa em</label><input id="rIni" type="date" class="form-control" formControlName="inicio"></div>
          }
          <div class="col-6 col-md-2"><label class="form-label" for="rFim">Termina em (opcional)</label><input id="rFim" type="date" class="form-control" formControlName="fim"></div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Salvar</button>
          <button type="button" class="btn btn-outline-primary btn-sm" (click)="editando.set(null)">Cancelar</button>
        </div>
      </form>
    }

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead><tr><th>Descrição</th><th>Pessoa</th><th>Tipo</th><th class="text-end">Valor</th><th>Dia</th><th>Período</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (r of itens(); track r.id) {
            <tr [class.text-secondary]="!r.ativo">
              <td>{{ r.descricao }}</td><td>{{ r.pessoaNome }}</td><td>{{ rotuloTipo(r.tipo) }}</td><td class="text-end">{{ moeda(r.valor) }}</td><td>{{ r.diaVencimento }}</td>
              <td>{{ data(r.inicio) }} → {{ r.fim ? data(r.fim) : 'sem fim' }}</td>
              <td><span class="badge" [class]="r.ativo ? 'text-bg-success' : 'text-bg-secondary'">{{ r.ativo ? 'Ativa' : 'Encerrada' }}</span></td>
              <td class="text-end text-nowrap">
                <a class="btn btn-sm btn-outline-primary me-1" routerLink="/financeiro/titulos" [queryParams]="{ recorrenciaId: r.id }" [attr.aria-label]="'Ver títulos de ' + r.descricao">Títulos</a>
                <ng-container *appPode="'financeiro.titulos.editar'">
                  <button type="button" class="btn btn-sm btn-outline-primary me-1" [attr.aria-label]="'Alterar ' + r.descricao" (click)="alterar(r)"><i class="bi bi-pencil"></i></button>
                  <button type="button" class="btn btn-sm btn-outline-primary" [attr.aria-label]="(r.ativo ? 'Encerrar ' : 'Reativar ') + r.descricao" (click)="alternar(r)">{{ r.ativo ? 'Encerrar' : 'Reativar' }}</button>
                </ng-container>
              </td>
            </tr>
          } @empty { <tr><td colspan="8" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhuma conta fixa cadastrada.' }}</td></tr> }
        </tbody>
      </table>
    </div>
  `
})
export class ContasFixasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(FinanceiroTitulosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private fornecedores = inject(FornecedorService);
  private clientes = inject(ClienteService);
  private toast = inject(ToastService);

  readonly tipos: { valor: TipoTitulo; rotulo: string }[] = [{ valor: 'pagar', rotulo: 'A pagar' }, { valor: 'receber', rotulo: 'A receber' }];

  itens = signal<Recorrencia[]>([]);
  categorias = signal<CategoriaFin[]>([]);
  centros = signal<CentroCustoFin[]>([]);
  /** 0 = nova; um id = alterando; null = fechado. */
  editando = signal<number | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  erro = signal('');

  form = this.fb.nonNullable.group({
    tipo: ['pagar' as TipoTitulo], pessoaId: [0], pessoaNome: [''],
    descricao: ['', [Validators.required, Validators.maxLength(255)]], documento: [''],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    diaVencimento: [5 as number | null, [Validators.required, Validators.min(1), Validators.max(31)]],
    categoriaId: [null as number | null, Validators.required], centroCustoId: [null as number | null],
    inicio: [hojeIso()], fim: ['']
  });

  private tipoForm = signal<TipoTitulo>('pagar');
  pessoas = computed(() => this.tipoForm() === 'pagar'
    ? this.fornecedores.fornecedores().filter(f => f.ativo).map(f => ({ id: f.id, nome: f.razaoSocial }))
    : this.clientes.clientes().filter(c => c.ativo).map(c => ({ id: c.id, nome: c.nome })));
  categoriasDoTipo = computed(() => this.categorias().filter(c => c.natureza === (this.tipoForm() === 'pagar' ? 'despesa' : 'receita') && c.ativo));

  ngOnInit() {
    this.form.controls.tipo.valueChanges.subscribe(t => this.tipoForm.set(t ?? 'pagar'));
    this.fornecedores.getAll().subscribe({ error: () => undefined });
    this.clientes.getAll().subscribe({ error: () => undefined });
    this.cadastros.categorias().subscribe({ next: l => this.categorias.set(l), error: () => undefined });
    this.cadastros.centros().subscribe({ next: l => this.centros.set(l.filter(c => c.ativo)), error: () => undefined });
    this.carregar();
  }

  private carregar() {
    this.carregando.set(true);
    this.service.recorrencias().subscribe({
      next: l => { this.itens.set(l); this.carregando.set(false); },
      error: e => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar as contas fixas.'), 'Não foi possível carregar as contas fixas.')); }
    });
  }

  nova() {
    this.form.reset({ tipo: 'pagar', pessoaId: 0, pessoaNome: '', descricao: '', documento: '', valor: null, diaVencimento: 5, categoriaId: null, centroCustoId: null, inicio: hojeIso(), fim: '' });
    this.tipoForm.set('pagar');
    this.editando.set(0);
  }

  alterar(r: Recorrencia) {
    this.tipoForm.set(r.tipo);
    this.form.reset({
      tipo: r.tipo, pessoaId: r.fornecedorId ?? r.clienteId ?? 0, pessoaNome: r.pessoaNome ?? '', descricao: r.descricao, documento: r.documento ?? '',
      valor: r.valor, diaVencimento: r.diaVencimento, categoriaId: r.categoriaId, centroCustoId: r.centroCustoId, inicio: r.inicio, fim: r.fim ?? ''
    });
    this.editando.set(r.id);
  }

  inv(campo: string) { const c = this.form.get(campo); return !!c && c.invalid && c.touched; }

  salvar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const f = this.form.getRawValue();
    const id = this.editando();
    this.salvando.set(true);
    const op = id
      ? this.service.atualizarRecorrencia(id, {
        descricao: f.descricao.trim(), documento: f.documento?.trim() ?? '', valor: Number(f.valor), diaVencimento: Number(f.diaVencimento),
        categoriaId: f.categoriaId!, ...(f.centroCustoId ? { centroCustoId: f.centroCustoId } : {}),
        ...(f.fim ? { fim: f.fim } : { limparFim: true })
      })
      : this.service.criarRecorrencia({
        tipo: f.tipo, fornecedorId: f.tipo === 'pagar' && f.pessoaId ? f.pessoaId : null, clienteId: f.tipo === 'receber' && f.pessoaId ? f.pessoaId : null,
        pessoaNome: f.pessoaId === 0 ? f.pessoaNome?.trim() || null : null, descricao: f.descricao.trim(), documento: f.documento?.trim() || null,
        valor: Number(f.valor), diaVencimento: Number(f.diaVencimento), categoriaId: f.categoriaId!, centroCustoId: f.centroCustoId,
        inicio: f.inicio, fim: f.fim || null
      });
    op.subscribe({
      next: () => { this.salvando.set(false); this.editando.set(null); this.toast.sucesso('Conta fixa salva.'); this.carregar(); },
      error: e => { this.salvando.set(false); this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível salvar.'), 'Não foi possível salvar.')); }
    });
  }

  alternar(r: Recorrencia) {
    this.service.atualizarRecorrencia(r.id, { ativo: !r.ativo }).subscribe({
      next: () => { this.toast.sucesso(r.ativo ? 'Conta fixa encerrada.' : 'Conta fixa reativada.'); this.carregar(); },
      error: e => this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível alterar.'), 'Não foi possível alterar.'))
    });
  }

  rotuloTipo(t: TipoTitulo) { return ROTULO_TIPO_TITULO[t]; }
  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }
}
