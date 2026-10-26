import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobBem, SalvarImobBem, bemEditavel } from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { formatarPercentual, formatarVidaUtil } from '../../../core/utils/imob-formato';
import { dataAquisicaoValida, duasCasas, hojeIso, inteiro } from '../../../core/utils/validadores';
import { SeletorLocalComponent } from '../shared/seletor-local.component';
import { AutocompleteResponsavelComponent } from '../shared/autocomplete-responsavel.component';

type Campo =
  | 'plaqueta' | 'descricao' | 'categoriaId' | 'localId' | 'responsavelId' | 'dataAquisicao'
  | 'valorAquisicao' | 'valorResidual' | 'vidaUtilMeses'
  | 'fornecedorNome' | 'numeroDocumentoAquisicao' | 'numeroSerie' | 'observacao';

const LIMITES: Partial<Record<Campo, number>> = {
  plaqueta: 50, descricao: 500, fornecedorNome: 255, numeroDocumentoAquisicao: 100, numeroSerie: 100, observacao: 2000
};

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Residual não pode passar do valor de aquisição. */
function residualNaoMaior(c: AbstractControl): ValidationErrors | null {
  const aquisicao = c.parent?.get('valorAquisicao')?.value;
  const residual = c.value;
  if (typeof residual !== 'number') return null;
  if (typeof aquisicao !== 'number') return { residualSemValor: true };
  return residual > aquisicao ? { residualMaior: true } : null;
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly edicao = this.id !== null;
  readonly hoje = hojeIso();
  formatarVidaUtil = formatarVidaUtil;
  formatarPercentual = formatarPercentual;

  bem = signal<ImobBem | null>(null);
  categorias = signal<ImobCategoria[]>([]);
  arvore = signal<ImobLocalArvore[]>([]);
  loading = signal(false);
  erroCarga = signal('');
  naoEncontrado = signal(false);
  saving = signal(false);
  saveError = signal('');

  /** O usuário mexeu no campo: deixa de ser preenchido pela categoria e passa a ser enviado. */
  private residualTocado = false;
  private vidaTocada = false;

  form = this.fb.group({
    plaqueta: ['', [Validators.required, Validators.maxLength(50)]],
    descricao: ['', [Validators.required, Validators.maxLength(500)]],
    categoriaId: [null as number | null, [Validators.required]],
    localId: [null as number | null, [Validators.required]],
    responsavelId: [null as number | null],
    dataAquisicao: ['', [dataAquisicaoValida]],
    valorAquisicao: [null as number | null, [Validators.min(0), duasCasas]],
    valorResidual: [null as number | null, [Validators.min(0), duasCasas, residualNaoMaior]],
    vidaUtilMeses: [null as number | null, [Validators.min(1), Validators.max(1200), inteiro]],
    fornecedorNome: ['', [Validators.maxLength(255)]],
    numeroDocumentoAquisicao: ['', [Validators.maxLength(100)]],
    numeroSerie: ['', [Validators.maxLength(100)]],
    observacao: ['', [Validators.maxLength(2000)]]
  });

  private categoriaId = toSignal(this.form.controls.categoriaId.valueChanges, { initialValue: null });
  categoriaSelecionada = computed(() => this.categorias().find(c => c.id === this.categoriaId()) ?? null);

  /** Categorias ativas; na edição, a categoria atual do bem continua listada mesmo se inativa. */
  categoriasOpcoes = computed(() => {
    const atual = this.bem()?.categoriaId;
    return this.categorias().filter(c => c.ativo || c.id === atual);
  });

  /** Bem baixado/vendido não pode ser editado. */
  bloqueado = computed(() => {
    const b = this.bem();
    return b !== null && !bemEditavel(b.status);
  });

  constructor() {
    this.form.controls.categoriaId.valueChanges.subscribe(() => this.aplicarSugestoes());
    this.form.controls.valorAquisicao.valueChanges.subscribe(() => {
      this.recalcularResidual();
      // sem valor de aquisição não há residual (o servidor também o limpa)
      if (typeof this.form.controls.valorAquisicao.value !== 'number') {
        this.form.controls.valorResidual.setValue(null, { emitEvent: false });
      }
      this.form.controls.valorResidual.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit() {
    this.categoriaService.listar({ pageSize: 100 }).subscribe({
      next: res => { this.categorias.set(res.items); this.aplicarSugestoes(); },
      error: () => this.erroCarga.set('Não foi possível carregar as categorias.')
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
            responsavelId: bem.responsavelId ?? null, dataAquisicao: bem.dataAquisicao,
            valorAquisicao: bem.valorAquisicao, valorResidual: bem.valorResidual, vidaUtilMeses: bem.vidaUtilMeses,
            fornecedorNome: bem.fornecedorNome ?? '', numeroDocumentoAquisicao: bem.numeroDocumentoAquisicao ?? '',
            numeroSerie: bem.numeroSerie ?? '', observacao: bem.observacao ?? ''
          }, { emitEvent: false });
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
  marcarResidualTocado() { this.residualTocado = true; }

  private aplicarSugestoes() {
    if (this.edicao) return;
    const cat = this.categoriaSelecionada();
    if (!cat) return;
    if (!this.vidaTocada) this.form.controls.vidaUtilMeses.setValue(cat.vidaUtilMeses, { emitEvent: false });
    this.recalcularResidual();
  }

  private recalcularResidual() {
    if (this.edicao || this.residualTocado) return;
    const cat = this.categoriaSelecionada();
    const aquisicao = this.form.controls.valorAquisicao.value;
    this.form.controls.valorResidual.setValue(
      cat && typeof aquisicao === 'number' ? arredondar(aquisicao * cat.valorResidualPercentual / 100) : null,
      { emitEvent: false });
  }

  mostrarSugestao(campo: 'vida' | 'residual'): boolean {
    return !this.edicao && !!this.categoriaSelecionada() && !(campo === 'vida' ? this.vidaTocada : this.residualTocado);
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
      // data e valor são opcionais: vazios vão como null (limpam o campo na edição)
      dataAquisicao: v.dataAquisicao || null,
      valorAquisicao: v.valorAquisicao ?? null,
      // no cadastro, campos intocados são omitidos para o servidor aplicar os valores da categoria;
      // sem valor de aquisição não há residual
      valorResidual: v.valorAquisicao === null || (!this.edicao && !this.residualTocado) ? undefined : v.valorResidual ?? undefined,
      vidaUtilMeses: !this.edicao && !this.vidaTocada ? undefined : v.vidaUtilMeses ?? undefined,
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
          localId: ['local']
        }));
        this.saving.set(false);
      }
    });
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
    if (e['residualMaior']) return 'O valor residual não pode ser maior que o valor de aquisição.';
    if (e['min'] || e['max']) return nome === 'vidaUtilMeses' ? 'Informe de 1 a 1200 meses.' : 'Informe um valor maior ou igual a zero.';
    return '';
  }
}
