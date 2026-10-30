import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImobReavaliacaoEscalaService } from '../../../core/services/imob-reavaliacao-escala.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobEscala, ImobEscalaFaixa, ImobEscalaNota, ROTULO_ESCALA, TipoEscala } from '../../../core/models/imob-reavaliacao.model';
import { FaixaEdicao, MAX_FAIXAS, notaDaEscala, validarFaixas } from '../../../core/utils/escala-faixas';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora, formatarNumero } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { podeEditarParametros } from './pode-editar-parametros';

const HIST_PAGE_SIZE = 10;

type LinhaForm = FormGroup<{ de: FormControl<number | null>; ate: FormControl<number | null>; nota: FormControl<number | null> }>;

@Component({
  selector: 'app-imob-reavaliacao-escalas',
  standalone: true,
  imports: [ReactiveFormsModule, PaginacaoComponent],
  templateUrl: './imob-reavaliacao-escalas.component.html'
})
export class ImobReavaliacaoEscalasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobReavaliacaoEscalaService);
  permissao = inject(PermissaoService);

  readonly tipos: TipoEscala[] = ['vp', 'vf'];
  readonly rotulos = ROTULO_ESCALA;
  readonly maxFaixas = MAX_FAIXAS;
  readonly histPageSize = HIST_PAGE_SIZE;
  formatarDataHora = formatarDataHora;
  formatarNumero = formatarNumero;

  /** Leitura para todos; nova versão só para quem pode (hoje admin). */
  podeEditar = () => podeEditarParametros(this.permissao);

  tipo = signal<TipoEscala>('vp');
  vigente = signal<ImobEscala | null>(null);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  linhas = this.fb.array<LinhaForm>([]);
  motivo = this.fb.control('', [Validators.maxLength(500)]);
  /** Espelho das faixas digitadas, para a validação visual reagir a cada tecla. */
  private faixasEdicao = signal<FaixaEdicao[]>([]);

  validacao = computed(() => validarFaixas(this.faixasEdicao()));
  /** Há diferença entre o editor e a versão vigente. */
  alterada = computed(() => {
    const v = this.vigente();
    if (!v) return false;
    const atual = this.faixasEdicao();
    return atual.length !== v.faixas.length
      || atual.some((f, i) => f.de !== v.faixas[i].de || f.ate !== v.faixas[i].ate || f.nota !== v.faixas[i].nota);
  });

  saving = signal(false);
  saveError = signal('');

  // testar valor
  valorTeste = new FormControl<number | null>(null);
  testando = signal(false);
  resultadoTeste = signal<ImobEscalaNota | null>(null);
  notaRascunho = signal<number | null | undefined>(undefined);
  erroTeste = signal('');

  // histórico
  historico = signal<ImobEscala[]>([]);
  histTotal = signal(0);
  histPage = signal(1);
  histLoading = signal(false);
  histErro = signal('');

  ngOnInit() {
    this.trocarTipo('vp');
  }

  trocarTipo(tipo: TipoEscala) {
    this.tipo.set(tipo);
    this.feedback.set('');
    this.saveError.set('');
    this.limparTeste();
    this.carregar();
    this.carregarHistorico(1);
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.vigente(this.tipo()).subscribe({
      next: v => {
        this.vigente.set(v);
        this.carregarNoEditor(v.faixas);
        this.motivo.reset('');
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar a escala.'), 'Erro ao carregar a escala.'));
        this.loading.set(false);
      }
    });
  }

  carregarHistorico(page: number) {
    this.histLoading.set(true);
    this.histErro.set('');
    this.service.historico(this.tipo(), page, HIST_PAGE_SIZE).subscribe({
      next: res => {
        this.historico.set(res.items);
        this.histTotal.set(res.total);
        this.histPage.set(page);
        this.histLoading.set(false);
      },
      error: err => {
        this.histErro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar o histórico de versões.'), 'Erro ao carregar o histórico de versões.'));
        this.histLoading.set(false);
      }
    });
  }

  // ---- editor ----

  private novaLinha(f: FaixaEdicao): LinhaForm {
    return this.fb.group({
      de: new FormControl<number | null>(f.de),
      ate: new FormControl<number | null>(f.ate),
      nota: new FormControl<number | null>(f.nota)
    });
  }

  private sincronizar() {
    this.faixasEdicao.set(this.linhas.getRawValue().map(l => ({ de: l.de, ate: l.ate, nota: l.nota })));
    this.notaRascunho.set(undefined);
  }

  /** Substitui o conteúdo do editor (versão vigente ou uma versão antiga usada como base). */
  carregarNoEditor(faixas: readonly ImobEscalaFaixa[]) {
    this.linhas.clear({ emitEvent: false });
    for (const f of faixas) {
      const linha = this.novaLinha({ de: f.de, ate: f.ate, nota: f.nota });
      linha.valueChanges.subscribe(() => this.sincronizar());
      this.linhas.push(linha, { emitEvent: false });
    }
    this.sincronizar();
  }

  usarComoBase(escala: ImobEscala) {
    this.carregarNoEditor(escala.faixas);
    this.saveError.set('');
    this.feedback.set(`Faixas da versão ${escala.versao} carregadas no editor. Salve para criar uma nova versão.`);
  }

  adicionarFaixa() {
    if (this.linhas.length >= MAX_FAIXAS) return;
    const ultima = this.linhas.length ? this.linhas.at(this.linhas.length - 1) : null;
    let inicio = 0;
    if (ultima) {
      const { de, ate } = ultima.getRawValue();
      if (ate === null && typeof de === 'number') {
        // a última deixa de ser aberta: ganha um término provisório e a nova continua a partir dele
        inicio = de + 1;
        ultima.controls.ate.setValue(inicio, { emitEvent: false });
      } else {
        inicio = ate ?? 0;
      }
    }
    const linha = this.novaLinha({ de: inicio, ate: null, nota: null });
    linha.valueChanges.subscribe(() => this.sincronizar());
    this.linhas.push(linha, { emitEvent: false });
    this.sincronizar();
  }

  removerFaixa(i: number) {
    this.linhas.removeAt(i, { emitEvent: false });
    this.sincronizar();
  }

  /** Faz o início de cada faixa igual ao término da anterior (corrige lacunas e sobreposições). */
  encaixarFaixas() {
    for (let i = 1; i < this.linhas.length; i++) {
      const ate = this.linhas.at(i - 1).controls.ate.value;
      if (typeof ate === 'number') this.linhas.at(i).controls.de.setValue(ate, { emitEvent: false });
    }
    this.sincronizar();
  }

  descartar() {
    const v = this.vigente();
    if (v) this.carregarNoEditor(v.faixas);
    this.motivo.reset('');
    this.saveError.set('');
  }

  salvar() {
    this.saveError.set('');
    this.feedback.set('');
    if (this.motivo.invalid) { this.motivo.markAsTouched(); return; }
    if (!this.validacao().valida) {
      this.saveError.set('Corrija as faixas destacadas antes de salvar.');
      return;
    }
    if (!this.alterada()) {
      this.saveError.set('Nenhuma alteração em relação à versão vigente.');
      return;
    }
    this.saving.set(true);
    const tipo = this.tipo();
    this.service.criarVersao(tipo, {
      motivo: this.motivo.value?.trim() || undefined,
      faixas: this.faixasEdicao().map(f => ({ de: f.de!, ate: f.ate, nota: f.nota! }))
    }).subscribe({
      next: nova => {
        this.saving.set(false);
        this.vigente.set(nova);
        this.carregarNoEditor(nova.faixas);
        this.motivo.reset('');
        this.limparTeste();
        this.feedback.set(`Versão ${nova.versao} da ${this.rotulos[tipo].titulo} criada e vigente.`);
        this.carregarHistorico(1);
      },
      error: err => {
        this.saveError.set(textoDoErro(lerErroApi(err, 'Erro ao criar a versão da escala.'), 'Erro ao criar a versão da escala.'));
        this.saving.set(false);
      }
    });
  }

  // ---- testar valor ----

  private limparTeste() {
    this.valorTeste.reset(null);
    this.resultadoTeste.set(null);
    this.notaRascunho.set(undefined);
    this.erroTeste.set('');
  }

  /** Consulta a nota que a versão vigente (a salva) dá ao valor; compara com o rascunho do editor. */
  testar() {
    const valor = this.valorTeste.value;
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      this.erroTeste.set('Informe um valor para testar.');
      return;
    }
    this.erroTeste.set('');
    this.testando.set(true);
    this.service.nota(this.tipo(), valor).subscribe({
      next: res => {
        this.testando.set(false);
        this.resultadoTeste.set(res);
        this.notaRascunho.set(this.validacao().valida && this.alterada() ? notaDaEscala(this.faixasEdicao(), valor) : undefined);
      },
      error: err => {
        this.testando.set(false);
        this.resultadoTeste.set(null);
        this.erroTeste.set(textoDoErro(lerErroApi(err, 'Erro ao testar o valor.'), 'Erro ao testar o valor.'));
      }
    });
  }

  intervalo(f: { de: number; ate: number | null }): string {
    return `[${formatarNumero(f.de)}, ${f.ate === null ? '∞' : formatarNumero(f.ate)})`;
  }
}
