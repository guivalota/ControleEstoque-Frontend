import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobDepartamentoService } from '../../../core/services/imob-departamento.service';
import { ImobGrupoService } from '../../../core/services/imob-grupo.service';
import { ImobGrupo } from '../../../core/models/imob-grupo.model';
import { ImobDepartamento } from '../../../core/models/imob-departamento.model';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { Fornecedor } from '../../../core/models/fornecedor.model';
import { ImobBem, SalvarImobBem, bemEditavel } from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { formatarVidaUtil } from '../../../core/utils/imob-formato';
import { dataAquisicaoValida, duasCasas, hojeIso, inteiro } from '../../../core/utils/validadores';
import { SeletorLocalComponent } from '../shared/seletor-local.component';
import { AutocompleteResponsavelComponent } from '../shared/autocomplete-responsavel.component';

type Campo =
  | 'plaqueta' | 'descricao' | 'categoriaId' | 'localId' | 'responsavelId' | 'departamentoId' | 'dataAquisicao'
  | 'valorAquisicao' | 'valorResidual' | 'vidaUtilMeses'
  | 'fornecedorNome' | 'numeroDocumentoAquisicao' | 'numeroSerie' | 'observacao';

const LIMITES: Partial<Record<Campo, number>> = {
  plaqueta: 50, descricao: 500, fornecedorNome: 255, numeroDocumentoAquisicao: 100, numeroSerie: 100, observacao: 2000
};

/** Residual (quando maior que zero) precisa ser menor que o valor de aquisição, como no servidor. */
function residualMenorQueAquisicao(c: AbstractControl): ValidationErrors | null {
  const aquisicao = c.parent?.get('valorAquisicao')?.value;
  const residual = c.value;
  if (typeof residual !== 'number' || residual <= 0) return null;
  if (typeof aquisicao !== 'number') return { residualSemValor: true };
  return residual >= aquisicao ? { residualMaior: true } : null;
}

@Component({
  selector: 'app-imob-bem-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SeletorLocalComponent, AutocompleteResponsavelComponent],
  templateUrl: './imob-bem-form.component.html'
})
export class ImobBemFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobBemService);
  private categoriaService = inject(ImobCategoriaService);
  private localService = inject(ImobLocalService);
  private departamentoService = inject(ImobDepartamentoService);
  private grupoService = inject(ImobGrupoService);
  private fornecedorService = inject(FornecedorService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly edicao = this.id !== null;
  readonly hoje = hojeIso();
  formatarVidaUtil = formatarVidaUtil;

  bem = signal<ImobBem | null>(null);
  categorias = signal<ImobCategoria[]>([]);
  grupos = signal<ImobGrupo[]>([]);
  departamentos = signal<ImobDepartamento[]>([]);
  /** Fornecedores ativos do cadastro da empresa (opcional: o nome também pode ser digitado, PEND-065). */
  fornecedores = signal<Fornecedor[]>([]);
  arvore = signal<ImobLocalArvore[]>([]);
  loading = signal(false);
  erroCarga = signal('');
  naoEncontrado = signal(false);
  saving = signal(false);
  saveError = signal('');

  /** O usuário mexeu na vida útil: deixa de ser preenchida pela categoria e passa a ser enviada. */
  private vidaTocada = false;

  form = this.fb.group({
    plaqueta: ['', [Validators.required, Validators.maxLength(50)]],
    descricao: ['', [Validators.required, Validators.maxLength(500)]],
    /** Só filtra as categorias (o bem herda o grupo da categoria); não vai no corpo da requisição. */
    grupoId: [null as number | null],
    categoriaId: [null as number | null, [Validators.required]],
    localId: [null as number | null, [Validators.required]],
    responsavelId: [null as number | null],
    departamentoId: [null as number | null],
    dataAquisicao: ['', [dataAquisicaoValida]],
    valorAquisicao: [null as number | null, [Validators.min(0), duasCasas]],
    valorResidual: [null as number | null, [Validators.min(0), duasCasas, residualMenorQueAquisicao]],
    vidaUtilMeses: [null as number | null, [Validators.min(1), Validators.max(1200), inteiro]],
    fornecedorId: [null as number | null],
    fornecedorNome: ['', [Validators.maxLength(255)]],
    numeroDocumentoAquisicao: ['', [Validators.maxLength(100)]],
    numeroSerie: ['', [Validators.maxLength(100)]],
    observacao: ['', [Validators.maxLength(2000)]]
  });

  private categoriaId = toSignal(this.form.controls.categoriaId.valueChanges, { initialValue: null });
  categoriaSelecionada = computed(() => this.categorias().find(c => c.id === this.categoriaId()) ?? null);

  private grupoFiltro = toSignal(this.form.controls.grupoId.valueChanges, { initialValue: null as number | null });

  /** Grupos ativos; na edição, o grupo atual do bem continua listado mesmo se inativo. */
  gruposOpcoes = computed(() => {
    const atual = this.bem()?.grupoId;
    return this.grupos().filter(g => g.ativo || g.id === atual);
  });

  /** Categorias ativas; na edição, a categoria atual do bem continua listada mesmo se inativa. */
  categoriasOpcoes = computed(() => {
    const atual = this.bem()?.categoriaId;
    const grupo = this.grupoFiltro();
    return this.categorias().filter(c => (c.ativo || c.id === atual) && (grupo === null || c.grupoId === grupo));
  });

  /** Departamentos ativos; na edição, o departamento atual do bem continua listado mesmo se inativo. */
  departamentosOpcoes = computed(() => {
    const atual = this.bem()?.departamentoId;
    return this.departamentos().filter(d => d.ativo || d.id === atual);
  });

  /** Bem baixado/vendido não pode ser editado. */
  bloqueado = computed(() => {
    const b = this.bem();
    return b !== null && !bemEditavel(b.status);
  });

  constructor() {
    this.form.controls.categoriaId.valueChanges.subscribe(() => { this.aplicarSugestoes(); this.sincronizarGrupo(); });
    // Trocar o grupo para outro que não contém a categoria escolhida limpa a categoria
    this.form.controls.grupoId.valueChanges.subscribe(g => {
      const cat = this.categoriaSelecionada();
      if (g !== null && cat && cat.grupoId !== g) this.form.controls.categoriaId.setValue(null);
    });
    this.form.controls.valorAquisicao.valueChanges.subscribe(() => {
      // sem valor de aquisição não há residual (o servidor também o limpa)
      if (typeof this.form.controls.valorAquisicao.value !== 'number') {
        this.form.controls.valorResidual.setValue(null, { emitEvent: false });
      }
      this.form.controls.valorResidual.updateValueAndValidity({ emitEvent: false });
    });
  }

  /** Escolher a categoria mostra o grupo dela no seletor de grupo. */
  private sincronizarGrupo() {
    const cat = this.categoriaSelecionada();
    if (cat && cat.grupoId !== undefined && cat.grupoId !== null && cat.grupoId !== this.form.controls.grupoId.value) {
      this.form.controls.grupoId.setValue(cat.grupoId);
    }
  }

  ngOnInit() {
    this.grupoService.listar({ pageSize: 100 }).subscribe({
      next: res => this.grupos.set(res.items),
      error: () => this.grupos.set([]) // o filtro por grupo é opcional
    });
    this.categoriaService.listar({ pageSize: 100 }).subscribe({
      next: res => { this.categorias.set(res.items); this.aplicarSugestoes(); },
      error: () => this.erroCarga.set('Não foi possível carregar as categorias.')
    });
    this.departamentoService.listar({ page: 1, pageSize: 100 }).subscribe({
      next: res => this.departamentos.set(res.items),
      error: () => this.departamentos.set([]) // departamento é opcional
    });
    this.fornecedorService.buscar({ ativo: true, page: 1, pageSize: 100 }).subscribe({
      next: res => this.fornecedores.set(res.items),
      error: () => this.fornecedores.set([]) // cadastro de fornecedores é opcional aqui
    });
    this.localService.arvore().subscribe({
      next: a => this.arvore.set(a),
      error: () => this.erroCarga.set('Não foi possível carregar os locais.')
    });

    if (this.edicao) {
      this.loading.set(true);
      this.service.obter(this.id!).subscribe({
        next: bem => {
          this.bem.set(bem);
          this.form.reset({
            plaqueta: bem.plaqueta, descricao: bem.descricao, categoriaId: bem.categoriaId, localId: bem.localId,
            responsavelId: bem.responsavelId ?? null, departamentoId: bem.departamentoId ?? null, dataAquisicao: bem.dataAquisicao,
            valorAquisicao: bem.valorAquisicao, valorResidual: bem.valorResidual, vidaUtilMeses: bem.vidaUtilMeses,
            fornecedorId: bem.fornecedorId ?? null, fornecedorNome: bem.fornecedorNome ?? '', numeroDocumentoAquisicao: bem.numeroDocumentoAquisicao ?? '',
            numeroSerie: bem.numeroSerie ?? '', observacao: bem.observacao ?? ''
          }, { emitEvent: false });
          this.form.controls.grupoId.setValue(bem.grupoId ?? null);
          if (this.bloqueado()) this.form.disable({ emitEvent: false });
          this.loading.set(false);
        },
        error: err => {
          if (err.status === 404) this.naoEncontrado.set(true);
          else this.erroCarga.set(lerErroApi(err, 'Erro ao carregar o bem.').mensagem);
          this.loading.set(false);
        }
      });
    }
  }

  // ---- sugestões da categoria (só no cadastro) ----

  marcarVidaTocada() { this.vidaTocada = true; }

  private aplicarSugestoes() {
    if (this.edicao) return;
    const cat = this.categoriaSelecionada();
    if (!cat) return;
    if (!this.vidaTocada) this.form.controls.vidaUtilMeses.setValue(cat.vidaUtilMeses, { emitEvent: false });
  }

  /** O residual NÃO vem da categoria (D-036): vazio = zero no servidor. */
  mostrarSugestaoVida(): boolean {
    return !this.edicao && !!this.categoriaSelecionada() && !this.vidaTocada;
  }

  // ---- envio ----

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const texto = (s: string | null) => s?.trim() || undefined;
    const payload: SalvarImobBem = {
      plaqueta: v.plaqueta!.trim(),
      descricao: v.descricao!.trim(),
      categoriaId: v.categoriaId!,
      localId: v.localId!,
      responsavelId: v.responsavelId,
      departamentoId: v.departamentoId,
      // data e valor são opcionais: vazios vão como null (limpam o campo na edição)
      dataAquisicao: v.dataAquisicao || null,
      valorAquisicao: v.valorAquisicao ?? null,
      // residual vazio é omitido: o servidor assume zero no cadastro e mantém o atual na edição (D-036);
      // sem valor de aquisição não há residual
      valorResidual: v.valorAquisicao === null ? undefined : v.valorResidual ?? undefined,
      vidaUtilMeses: !this.edicao && !this.vidaTocada ? undefined : v.vidaUtilMeses ?? undefined,
      // do cadastro: vai o id (o servidor usa a razão social como nome); digitado à mão: só o texto
      ...(v.fornecedorId ? { fornecedorId: v.fornecedorId } : {}),
      fornecedorNome: texto(v.fornecedorNome),
      numeroDocumentoAquisicao: texto(v.numeroDocumentoAquisicao),
      numeroSerie: texto(v.numeroSerie),
      observacao: texto(v.observacao)
    };

    const op = this.edicao ? this.service.atualizar(this.id!, payload) : this.service.criar(payload);
    op.subscribe({
      next: salvo => {
        this.saving.set(false);
        this.router.navigate(['/imobilizado/bens', salvo?.id ?? this.id]);
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar bem.'), {
          plaqueta: ['plaqueta'],
          valorResidual: ['residual'],
          dataAquisicao: ['data de aquisição', 'data de aquisicao', 'data da aquisição', 'dataaquisicao'],
          vidaUtilMeses: ['vida útil', 'vida util'],
          valorAquisicao: ['valor de aquisição', 'valor de aquisicao'],
          categoriaId: ['categoria'],
          responsavelId: ['responsável', 'responsavel'],
          departamentoId: ['departamento'],
          localId: ['local']
        }));
        this.saving.set(false);
      }
    });
  }

  /** Escolha no cadastro: grava o id e copia a razão social; "nenhum" mantém o texto livre. */
  escolherFornecedor(valor: string) {
    const id = valor ? Number(valor) : null;
    this.form.controls.fornecedorId.setValue(id);
    const f = this.fornecedores().find(x => x.id === id);
    if (f) this.form.controls.fornecedorNome.setValue(f.razaoSocial);
  }

  /** Digitar o nome à mão desfaz o vínculo com o cadastro (senão o servidor trocaria o texto pela razão social). */
  aoDigitarFornecedor() {
    this.form.controls.fornecedorId.setValue(null);
  }

  erroCampo(nome: Campo): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched || !c.errors) return '';
    const e = c.errors;
    if (e['required']) return 'Campo obrigatório.';
    if (e['maxlength']) return `Máximo de ${LIMITES[nome] ?? e['maxlength'].requiredLength} caracteres.`;
    if (e['data']) return 'Data inválida.';
    if (e['dataMinima']) return 'A data não pode ser anterior a 01/01/1900.';
    if (e['dataFutura']) return 'A data não pode ser futura.';
    if (e['casas']) return 'Use no máximo 2 casas decimais.';
    if (e['inteiro']) return 'Informe um número inteiro.';
    if (e['residualSemValor']) return 'Informe o valor de aquisição para definir o residual.';
    if (e['residualMaior']) return 'O valor residual deve ser menor que o valor de aquisição.';
    if (e['min'] || e['max']) return nome === 'vidaUtilMeses' ? 'Informe de 1 a 1200 meses.' : 'Informe um valor maior ou igual a zero.';
    return '';
  }
}
