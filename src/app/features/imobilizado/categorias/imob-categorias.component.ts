import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Modal } from 'bootstrap';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { ImobGrupoService } from '../../../core/services/imob-grupo.service';
import { ImobGrupo } from '../../../core/models/imob-grupo.model';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { duasCasas, inteiro } from '../../../core/utils/validadores';
import { formatarPercentual, formatarVidaUtil } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';

const PAGE_SIZE = 50;

interface Bloqueio {
  categoria: ImobCategoria;
  mensagem: string;
}

@Component({
  selector: 'app-imob-categorias',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ConfirmDialogComponent, PaginacaoComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-categorias.component.html'
})
export class ImobCategoriasComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobCategoriaService);
  private grupoService = inject(ImobGrupoService);
  grupos = signal<ImobGrupo[]>([]);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly pageSize = PAGE_SIZE;
  formatarVidaUtil = formatarVidaUtil;
  formatarPercentual = formatarPercentual;

  categorias = signal<ImobCategoria[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  busca = '';
  ativoFiltro: '' | 'true' | 'false' = '';

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  agindo = signal<number | null>(null);
  carregandoPadrao = signal(false);
  bloqueio = signal<Bloqueio | null>(null);

  /** Carregar categorias padrão: só admin (perfil efetivo na empresa ativa). */
  podeCarregarPadrao = () => this.permissao.perfil() === 'admin';

  form = this.fb.group({
    codigo: ['', [Validators.maxLength(50)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    vidaUtilMeses: [null as number | null, [Validators.required, Validators.min(1), Validators.max(1200), inteiro]],
    valorResidualPercentual: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100), duasCasas]],
    metodoDepreciacao: ['linear' as const],
    grupoId: [null as number | null],
    ativo: [true]
  });

  private vidaUtilForm = toSignal(this.form.controls.vidaUtilMeses.valueChanges, { initialValue: null });
  /** Dica "10 anos" exibida sob o campo, enquanto o valor digitado for válido. */
  dicaVidaUtil = () => {
    const v = this.vidaUtilForm();
    return typeof v === 'number' && v >= 1 && v <= 1200 && Number.isInteger(v) ? formatarVidaUtil(v) : '';
  };

  ngOnInit() {
    this.grupoService.listar({ pageSize: 100 }).subscribe({ next: r => this.grupos.set(r.items), error: () => undefined });
    this.carregar(1);
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar({
      busca: this.busca.trim() || undefined,
      ativo: this.ativoFiltro === '' ? undefined : this.ativoFiltro === 'true',
      page,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: res => {
        this.categorias.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar categorias.').mensagem);
        this.loading.set(false);
      }
    });
  }

  async carregarPadrao() {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Carregar categorias padrão',
      mensagem: 'Cria as categorias padrão que ainda não existem (MOV, MAQ e HW). As categorias existentes não são alteradas.',
      confirmar: 'Carregar'
    });
    if (!ok) return;
    this.carregandoPadrao.set(true);
    this.erro.set('');
    this.feedback.set('');
    this.service.carregarPadrao().subscribe({
      next: res => {
        this.carregandoPadrao.set(false);
        this.feedback.set(`Categorias padrão: ${res.criadas} ${res.criadas === 1 ? 'criada' : 'criadas'}, ${res.jaExistentes} já ${res.jaExistentes === 1 ? 'existente' : 'existentes'}.`);
        this.carregar(1);
      },
      error: err => {
        this.carregandoPadrao.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar categorias padrão.'), 'Erro ao carregar categorias padrão.'));
      }
    });
  }

  limparFiltros() {
    this.busca = '';
    this.ativoFiltro = '';
    this.carregar(1);
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ codigo: '', nome: '', vidaUtilMeses: null, valorResidualPercentual: null, metodoDepreciacao: 'linear', grupoId: null, ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(c: ImobCategoria) {
    this.editingId.set(c.id);
    this.form.reset({
      codigo: c.codigo ?? '',
      nome: c.nome,
      vidaUtilMeses: c.vidaUtilMeses,
      valorResidualPercentual: c.valorResidualPercentual,
      metodoDepreciacao: c.metodoDepreciacao,
      grupoId: c.grupoId ?? null,
      ativo: c.ativo
    });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = {
      ...(v.codigo?.trim() ? { codigo: v.codigo.trim() } : {}),
      nome: v.nome!.trim(),
      vidaUtilMeses: v.vidaUtilMeses!,
      valorResidualPercentual: v.valorResidualPercentual!,
      metodoDepreciacao: v.metodoDepreciacao ?? 'linear' as const,
      ...(v.grupoId ? { grupoId: v.grupoId } : {})
    };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Categoria atualizada.' : 'Categoria criada.');
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar categoria.'), {
          vidaUtilMeses: ['vida útil', 'vida util'],
          valorResidualPercentual: ['residual'],
          metodoDepreciacao: ['método', 'metodo'],
          codigo: ['código', 'codigo'],
          grupoId: ['grupo'],
          nome: ['nome']
        }));
        this.saving.set(false);
      }
    });
  }

  async excluir(c: ImobCategoria) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir categoria',
      mensagem: `Excluir a categoria "${c.nome}"? Prefira desativar se ela já foi usada.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(c.id);
    this.bloqueio.set(null);
    this.service.excluir(c.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Categoria excluída.');
        this.carregar(this.categorias().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        const e = lerErroApi(err, 'Erro ao excluir categoria.');
        if (err.status === 400 && e.mensagem) this.bloqueio.set({ categoria: c, mensagem: e.mensagem });
        else this.erro.set(e.mensagem);
      }
    });
  }

  desativar() {
    const c = this.bloqueio()?.categoria;
    if (!c) return;
    this.agindo.set(c.id);
    this.service.atualizar(c.id, {
      ...(c.codigo?.trim() ? { codigo: c.codigo.trim() } : {}),
      nome: c.nome,
      vidaUtilMeses: c.vidaUtilMeses,
      valorResidualPercentual: c.valorResidualPercentual,
      metodoDepreciacao: c.metodoDepreciacao,
      ...(c.grupoId ? { grupoId: c.grupoId } : {}),
      ativo: false
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Categoria "${c.nome}" desativada.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao desativar categoria.').mensagem);
      }
    });
  }

  bloqueioTemBens(): boolean {
    return !!this.bloqueio()?.mensagem.toLowerCase().includes('bens');
  }

  erroCampo(nome: 'codigo' | 'nome' | 'vidaUtilMeses' | 'valorResidualPercentual'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return nome === 'codigo' ? 'Máximo de 50 caracteres.' : 'Máximo de 255 caracteres.';
    if (nome === 'vidaUtilMeses') {
      if (c.errors?.['min'] || c.errors?.['max']) return 'Informe de 1 a 1200 meses.';
      if (c.errors?.['inteiro']) return 'Informe um número inteiro de meses.';
    }
    if (nome === 'valorResidualPercentual') {
      if (c.errors?.['min'] || c.errors?.['max']) return 'Informe um percentual de 0 a 100.';
      if (c.errors?.['casas']) return 'Use no máximo 2 casas decimais.';
    }
    return '';
  }
}
