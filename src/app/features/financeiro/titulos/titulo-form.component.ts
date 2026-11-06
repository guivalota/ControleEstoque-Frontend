import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { FinanceiroTitulosService } from '../../../core/services/financeiro-titulos.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { ClienteService } from '../../../core/services/cliente.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoriaFin, CentroCustoFin } from '../../../core/models/financeiro-cadastros.model';
import { CriarTitulo, TipoTitulo, TituloDetalhe } from '../../../core/models/financeiro-titulos.model';
import { dividirParcelas, hojeIso, somarMeses } from '../../../core/utils/financeiro-datas';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/**
 * Novo título, edição e lançamento parcelado (US-24-03 / US-24-09). Com baixa, valor e pessoa ficam bloqueados (o servidor também
 * recusa); o tipo nunca muda. A pré-visualização das parcelas usa a mesma regra do servidor (soma exata, vencimento mensal).
 */
@Component({
  selector: 'app-titulo-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <h1 class="h4 mb-3">{{ editandoId() ? 'Editar título' : 'Novo título' }}</h1>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }
    @if (bloqueado()) {
      <div class="alert alert-info" role="status">Este título já tem baixa: o valor e a pessoa não podem mudar. Para isso, estorne as baixas antes.</div>
    }
    <form [formGroup]="form" (submit)="$event.preventDefault(); salvar()" class="card card-body">
      <div class="row g-3">
        @if (!editandoId()) {
          <div class="col-12">
            <div class="btn-group" role="group" aria-label="Tipo do título">
              @for (t of tipos; track t.valor) {
                <input type="radio" class="btn-check" formControlName="tipo" [value]="t.valor" [id]="'tipo-' + t.valor" (change)="aoTrocarTipo()">
                <label class="btn btn-outline-primary" [for]="'tipo-' + t.valor">{{ t.rotulo }}</label>
              }
            </div>
          </div>
        }
        <div class="col-12 col-md-6">
          <label class="form-label" for="tPessoa">{{ tipoAtual() === 'pagar' ? 'Fornecedor' : 'Cliente' }}</label>
          <select id="tPessoa" class="form-select" formControlName="pessoaId" (change)="aoTrocarPessoa()">
            <option [ngValue]="0">Outro (digitar o nome)</option>
            @for (p of pessoas(); track p.id) { <option [ngValue]="p.id">{{ p.nome }}</option> }
          </select>
        </div>
        @if (form.controls.pessoaId.value === 0) {
          <div class="col-12 col-md-6">
            <label class="form-label" for="tNome">Nome</label>
            <input id="tNome" class="form-control" formControlName="pessoaNome" maxlength="200" [class.is-invalid]="invalido('pessoaNome')">
          </div>
        }
        <div class="col-12 col-md-8">
          <label class="form-label" for="tDesc">Descrição</label>
          <input id="tDesc" class="form-control" formControlName="descricao" maxlength="255" [class.is-invalid]="invalido('descricao')">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label" for="tDoc">Documento (opcional)</label>
          <input id="tDoc" class="form-control" formControlName="documento" maxlength="60">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="tValor">{{ parcelar() ? 'Valor total (R$)' : 'Valor (R$)' }}</label>
          <input id="tValor" type="number" step="0.01" min="0.01" class="form-control" formControlName="valor" [class.is-invalid]="invalido('valor')">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="tEmissao">Emissão</label>
          <input id="tEmissao" type="date" class="form-control" formControlName="emissao">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="tVenc">{{ parcelar() ? 'Vencimento da 1ª parcela' : 'Vencimento' }}</label>
          <input id="tVenc" type="date" class="form-control" formControlName="vencimento" [class.is-invalid]="invalido('vencimento')">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="tComp">Competência (opcional)</label>
          <input id="tComp" type="month" class="form-control" formControlName="competencia">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="tCat">Categoria</label>
          <select id="tCat" class="form-select" formControlName="categoriaId" [class.is-invalid]="invalido('categoriaId')">
            <option [ngValue]="null" disabled>Escolha…</option>
            @for (c of categoriasDoTipo(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
          </select>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="tCen">Centro de custo (opcional)</label>
          <select id="tCen" class="form-select" formControlName="centroCustoId">
            <option [ngValue]="null">Nenhum</option>
            @for (c of centros(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
          </select>
        </div>

        @if (!editandoId()) {
          <div class="col-12">
            <div class="form-check">
              <input id="tParcelar" type="checkbox" class="form-check-input" formControlName="parcelar">
              <label class="form-check-label" for="tParcelar">Parcelar este lançamento</label>
            </div>
          </div>
          @if (parcelar()) {
            <div class="col-6 col-md-3">
              <label class="form-label" for="tParcelas">Parcelas (2 a 60)</label>
              <input id="tParcelas" type="number" min="2" max="60" class="form-control" formControlName="parcelas" [class.is-invalid]="invalido('parcelas')">
            </div>
            <div class="col-12">
              @if (previa().length) {
                <table class="table table-sm w-auto mb-0">
                  <caption class="caption-top small">Pré-visualização: {{ previa().length }} parcela(s), vencimento mensal.</caption>
                  <thead><tr><th>Parcela</th><th>Vencimento</th><th class="text-end">Valor</th></tr></thead>
                  <tbody>
                    @for (p of previa(); track p.numero) {
                      <tr><td>{{ p.numero }}/{{ previa().length }}</td><td>{{ data(p.vencimento) }}</td><td class="text-end">{{ moeda(p.valor) }}</td></tr>
                    }
                  </tbody>
                </table>
              } @else {
                <span class="small text-secondary">Informe o valor total e o vencimento para ver as parcelas.</span>
              }
            </div>
          }
        }
      </div>
      <div class="mt-3 d-flex gap-2">
        <button type="submit" class="btn btn-primary" [disabled]="salvando()">{{ parcelar() ? 'Gerar parcelas' : 'Salvar' }}</button>
        <a class="btn btn-outline-primary" [routerLink]="editandoId() ? ['/financeiro/titulos', editandoId()] : ['/financeiro/titulos']">Cancelar</a>
      </div>
    </form>
  `
})
export class TituloFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private titulos = inject(FinanceiroTitulosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private fornecedores = inject(FornecedorService);
  private clientes = inject(ClienteService);
  private toast = inject(ToastService);
  private rota = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tipos: { valor: TipoTitulo; rotulo: string }[] = [{ valor: 'pagar', rotulo: 'A pagar' }, { valor: 'receber', rotulo: 'A receber' }];

  form = this.fb.nonNullable.group({
    tipo: ['pagar' as TipoTitulo],
    pessoaId: [0],
    pessoaNome: [''],
    descricao: ['', [Validators.required, Validators.maxLength(255)]],
    documento: [''],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    emissao: [hojeIso()],
    vencimento: ['', Validators.required],
    competencia: [''],
    categoriaId: [null as number | null, Validators.required],
    centroCustoId: [null as number | null],
    parcelar: [false],
    parcelas: [2, [Validators.min(2), Validators.max(60)]]
  });

  editandoId = signal<number | null>(null);
  salvando = signal(false);
  erro = signal('');
  bloqueado = signal(false);
  categorias = signal<CategoriaFin[]>([]);
  centros = signal<CentroCustoFin[]>([]);
  private categoriaOriginal: number | null = null;
  private centroOriginal: number | null = null;

  private valores = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  tipoAtual = computed(() => this.valores().tipo ?? 'pagar');
  parcelar = computed(() => !!this.valores().parcelar);

  pessoas = computed(() => this.tipoAtual() === 'pagar'
    ? this.fornecedores.fornecedores().filter(f => f.ativo).map(f => ({ id: f.id, nome: f.razaoSocial }))
    : this.clientes.clientes().filter(c => c.ativo).map(c => ({ id: c.id, nome: c.nome })));

  /** Pagar usa categoria de despesa; receber, de receita. Só as ativas (a que o título já tem continua valendo na edição). */
  categoriasDoTipo = computed(() => {
    const natureza = this.tipoAtual() === 'pagar' ? 'despesa' : 'receita';
    return this.categorias().filter(c => c.natureza === natureza && (c.ativo || c.id === this.categoriaOriginal));
  });

  previa = computed(() => {
    const v = this.valores();
    if (!this.parcelar() || !v.valor || !v.vencimento || !v.parcelas) return [];
    return dividirParcelas(Number(v.valor), Number(v.parcelas)).map((valor, i) => ({
      numero: i + 1, valor, vencimento: somarMeses(v.vencimento!, i)
    }));
  });

  ngOnInit() {
    this.fornecedores.getAll().subscribe({ error: () => undefined });
    this.clientes.getAll().subscribe({ error: () => undefined });
    this.cadastros.categorias().subscribe({ next: l => this.categorias.set(l), error: () => undefined });
    this.cadastros.centros().subscribe({ next: l => this.centros.set(l.filter(c => c.ativo || c.id === this.centroOriginal)), error: () => undefined });

    const id = Number(this.rota.snapshot.paramMap.get('id'));
    if (id) {
      this.editandoId.set(id);
      this.titulos.obter(id).subscribe({
        next: t => this.preencher(t),
        error: e => this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar o título.'), 'Não foi possível carregar o título.'))
      });
    } else {
      const tipo = this.rota.snapshot.queryParamMap.get('tipo');
      if (tipo === 'pagar' || tipo === 'receber') this.form.controls.tipo.setValue(tipo);
    }
  }

  private preencher(t: TituloDetalhe) {
    this.categoriaOriginal = t.categoriaId;
    this.centroOriginal = t.centroCustoId;
    this.bloqueado.set(t.status !== 'aberto');
    this.form.patchValue({
      tipo: t.tipo, pessoaId: t.fornecedorId ?? t.clienteId ?? 0, pessoaNome: t.fornecedorId || t.clienteId ? '' : (t.pessoaNome ?? ''),
      descricao: t.descricao, documento: t.documento ?? '', valor: t.valor, emissao: t.emissao, vencimento: t.vencimento,
      competencia: t.competencia.slice(0, 7), categoriaId: t.categoriaId, centroCustoId: t.centroCustoId
    });
    if (this.bloqueado()) { this.form.controls.valor.disable(); this.form.controls.pessoaId.disable(); this.form.controls.pessoaNome.disable(); }
    // Categoria e centro inativos que o título já usa precisam aparecer na lista.
    this.categorias.update(l => [...l]);
    this.cadastros.centros().subscribe({ next: l => this.centros.set(l.filter(c => c.ativo || c.id === t.centroCustoId)), error: () => undefined });
  }

  aoTrocarTipo() { this.form.patchValue({ pessoaId: 0, pessoaNome: '', categoriaId: null }); }
  aoTrocarPessoa() { if (this.form.controls.pessoaId.value !== 0) this.form.controls.pessoaNome.setValue(''); }

  invalido(campo: string) {
    const c = this.form.get(campo);
    return !!c && c.invalid && c.touched;
  }

  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }

  salvar() {
    const f = this.form.getRawValue();
    if (f.pessoaId === 0 && !f.pessoaNome?.trim()) this.form.controls.pessoaNome.setErrors({ required: true });
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.parcelar() && !this.previa().length) { this.erro.set('O valor total é pequeno demais para esse número de parcelas.'); return; }

    const corpo: CriarTitulo = {
      tipo: f.tipo,
      fornecedorId: f.tipo === 'pagar' && f.pessoaId ? f.pessoaId : null,
      clienteId: f.tipo === 'receber' && f.pessoaId ? f.pessoaId : null,
      pessoaNome: f.pessoaId === 0 ? f.pessoaNome?.trim() || null : null,
      descricao: f.descricao.trim(), documento: f.documento?.trim() || null, valor: Number(f.valor),
      emissao: f.emissao || null, vencimento: f.vencimento, competencia: f.competencia ? `${f.competencia}-01` : null,
      categoriaId: f.categoriaId!, centroCustoId: f.centroCustoId
    };
    this.salvando.set(true);
    this.erro.set('');
    const falha = (e: unknown) => { this.salvando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível salvar o título.'), 'Não foi possível salvar o título.')); };

    const id = this.editandoId();
    if (id) {
      this.titulos.atualizar(id, { ...corpo, emissao: corpo.emissao ?? hojeIso() }).subscribe({
        next: () => { this.toast.sucesso('Título atualizado.'); void this.router.navigate(['/financeiro/titulos', id]); }, error: falha
      });
    } else if (this.parcelar()) {
      this.titulos.criarParcelado({ ...corpo, parcelas: Number(f.parcelas) }).subscribe({
        next: r => { this.toast.sucesso(`${r.titulos.length} parcelas geradas.`); void this.router.navigate(['/financeiro/titulos'], { queryParams: { grupoId: r.grupoId } }); }, error: falha
      });
    } else {
      this.titulos.criar(corpo).subscribe({
        next: t => { this.toast.sucesso('Título criado.'); void this.router.navigate(['/financeiro/titulos', t.id]); }, error: falha
      });
    }
  }
}
