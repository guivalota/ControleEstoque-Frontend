import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators, AbstractControl } from '@angular/forms';
import { ImobReavaliacaoParametrosService } from '../../../core/services/imob-reavaliacao-parametros.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobParametrosVersao, ROTULO_CAMPO_PESO } from '../../../core/models/imob-reavaliacao.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora, formatarNumero } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { podeEditarParametros } from './pode-editar-parametros';

const HIST_PAGE_SIZE = 10;

function maisQueZero(c: AbstractControl): ValidationErrors | null {
  const v = c.value;
  return typeof v === 'number' && v <= 0 ? { divisorInvalido: true } : null;
}

type CampoForm = 'pesoEc' | 'pesoVf' | 'pesoVp' | 'divisor' | 'motivo';

@Component({
  selector: 'app-imob-reavaliacao-pesos',
  standalone: true,
  imports: [ReactiveFormsModule, PaginacaoComponent],
  templateUrl: './imob-reavaliacao-pesos.component.html'
})
export class ImobReavaliacaoPesosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobReavaliacaoParametrosService);
  permissao = inject(PermissaoService);

  readonly histPageSize = HIST_PAGE_SIZE;
  formatarDataHora = formatarDataHora;
  formatarNumero = formatarNumero;

  /** Leitura para todos; nova versão só para quem pode (hoje admin). */
  podeEditar = () => podeEditarParametros(this.permissao);

  vigente = signal<ImobParametrosVersao | null>(null);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  historico = signal<ImobParametrosVersao[]>([]);
  histTotal = signal(0);
  histPage = signal(1);
  histLoading = signal(false);
  histErro = signal('');

  saving = signal(false);
  saveError = signal('');

  form = this.fb.group({
    pesoEc: [null as number | null, [Validators.required, Validators.min(-1000), Validators.max(1000)]],
    pesoVf: [null as number | null, [Validators.required, Validators.min(-1000), Validators.max(1000)]],
    pesoVp: [null as number | null, [Validators.required, Validators.min(-1000), Validators.max(1000)]],
    divisor: [null as number | null, [Validators.required, maisQueZero]],
    motivo: ['', [Validators.maxLength(500)]]
  });

  ngOnInit() {
    this.carregar();
    this.carregarHistorico(1);
  }

  rotuloCampo(campo: string): string {
    return ROTULO_CAMPO_PESO[campo] ?? campo;
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.vigente().subscribe({
      next: v => {
        this.vigente.set(v);
        this.preencher(v);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar os pesos da reavaliação.'), 'Erro ao carregar os pesos da reavaliação.'));
        this.loading.set(false);
      }
    });
  }

  private preencher(v: ImobParametrosVersao) {
    this.form.reset({ pesoEc: v.pesoEc, pesoVf: v.pesoVf, pesoVp: v.pesoVp, divisor: v.divisor, motivo: '' });
  }

  carregarHistorico(page: number) {
    this.histLoading.set(true);
    this.histErro.set('');
    this.service.historico(page, HIST_PAGE_SIZE).subscribe({
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

  /** Sem nenhuma diferença para a versão vigente o servidor recusa; evitamos a ida e volta. */
  semMudanca(): boolean {
    const v = this.vigente();
    const f = this.form.getRawValue();
    return !!v && f.pesoEc === v.pesoEc && f.pesoVf === v.pesoVf && f.pesoVp === v.pesoVp && f.divisor === v.divisor;
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saveError.set('');
    this.feedback.set('');
    if (this.semMudanca()) {
      this.saveError.set('Nenhuma alteração em relação à versão vigente.');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.service.criarVersao({
      pesoEc: v.pesoEc!, pesoVf: v.pesoVf!, pesoVp: v.pesoVp!, divisor: v.divisor!,
      motivo: v.motivo?.trim() || undefined
    }).subscribe({
      next: nova => {
        this.saving.set(false);
        this.vigente.set(nova);
        this.preencher(nova);
        this.feedback.set(`Versão ${nova.versao} criada e vigente.`);
        this.carregarHistorico(1);
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao criar a versão dos pesos.'), {
          pesoEc: ['peso ec'], pesoVf: ['peso vf'], pesoVp: ['peso vp'], divisor: ['divisor'], motivo: ['motivo']
        }));
        this.saving.set(false);
      }
    });
  }

  erroCampo(nome: CampoForm): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched || !c.errors) return '';
    if (c.errors['required']) return 'Campo obrigatório.';
    if (c.errors['maxlength']) return 'Máximo de 500 caracteres.';
    if (c.errors['divisorInvalido']) return 'O divisor deve ser maior que zero.';
    if (c.errors['min'] || c.errors['max']) return 'Informe um valor de -1000 a 1000.';
    return '';
  }
}
