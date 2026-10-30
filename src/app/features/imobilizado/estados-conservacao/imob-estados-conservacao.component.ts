import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobEstadoConservacaoService } from '../../../core/services/imob-estado-conservacao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  ImobEstadoConservacao, ImobEstadoConservacaoHistorico, ROTULO_CAMPO_HISTORICO_ESTADO
} from '../../../core/models/imob-reavaliacao.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { duasCasas } from '../../../core/utils/validadores';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';
import { podeEditarParametros } from '../parametros/pode-editar-parametros';

const PAGE_SIZE = 50;
const HIST_PAGE_SIZE = 20;

interface Bloqueio {
  estado: ImobEstadoConservacao;
  mensagem: string;
}

const nota = [Validators.required, Validators.min(0), Validators.max(10), duasCasas];

@Component({
  selector: 'app-imob-estados-conservacao',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ConfirmDialogComponent, PaginacaoComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-estados-conservacao.component.html'
})
export class ImobEstadosConservacaoComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobEstadoConservacaoService);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private histEl = viewChild.required<ElementRef<HTMLElement>>('histEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;
  private histModal?: Modal;

  readonly pageSize = PAGE_SIZE;
  readonly histPageSize = HIST_PAGE_SIZE;
  formatarDataHora = formatarDataHora;

  /** Leitura para todos; edição só para quem pode (hoje admin). */
  podeEditar = () => podeEditarParametros(this.permissao);

  estados = signal<ImobEstadoConservacao[]>([]);
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

  // histórico
  histEstado = signal<ImobEstadoConservacao | null>(null);
  histItens = signal<ImobEstadoConservacaoHistorico[]>([]);
  histTotal = signal(0);
  histPage = signal(1);
  histLoading = signal(false);
  histErro = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(100)]],
    notaEc: [null as number | null, nota],
    notaVidaRemanescente: [null as number | null, nota],
    ativo: [true]
  });

  ngOnInit() {
    this.carregar(1);
  }

  ngOnDestroy() {
    this.modal?.dispose();
    this.histModal?.dispose();
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
        this.estados.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar estados de conservação.'), 'Erro ao carregar estados de conservação.'));
        this.loading.set(false);
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
    this.form.reset({ nome: '', notaEc: null, notaVidaRemanescente: null, ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(e: ImobEstadoConservacao) {
    this.editingId.set(e.id);
    this.form.reset({ nome: e.nome, notaEc: e.notaEc, notaVidaRemanescente: e.notaVidaRemanescente, ativo: e.ativo });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = { nome: v.nome!.trim(), notaEc: v.notaEc!, notaVidaRemanescente: v.notaVidaRemanescente! };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Estado atualizado.' : 'Estado criado.');
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar estado.'), {
          notaVidaRemanescente: ['vida remanescente'],
          notaEc: ['nota ec'],
          nome: ['nome']
        }));
        this.saving.set(false);
      }
    });
  }

  async carregarPadrao() {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Carregar estados padrão',
      mensagem: 'Cria os estados padrão que ainda não existem: Excelente (10/10), Bom (8/8), Razoável (5/5) e Ruim (2/2). Os existentes não mudam.',
      confirmar: 'Carregar'
    });
    if (!ok) return;
    this.carregandoPadrao.set(true);
    this.erro.set('');
    this.feedback.set('');
    this.service.carregarPadrao().subscribe({
      next: res => {
        this.carregandoPadrao.set(false);
        this.feedback.set(res.criados
          ? `Estados padrão: ${res.criados} ${res.criados === 1 ? 'criado' : 'criados'}.`
          : 'Estados padrão: nenhum criado, todos já existem.');
        this.carregar(1);
      },
      error: err => {
        this.carregandoPadrao.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar estados padrão.'), 'Erro ao carregar estados padrão.'));
      }
    });
  }

  async excluir(e: ImobEstadoConservacao) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir estado de conservação',
      mensagem: `Excluir o estado "${e.nome}"? Prefira inativar se ele já foi usado.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(e.id);
    this.bloqueio.set(null);
    this.service.excluir(e.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Estado excluído.');
        this.carregar(this.estados().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        const erro = lerErroApi(err, 'Erro ao excluir estado.');
        if (err.status === 400 && erro.mensagem) this.bloqueio.set({ estado: e, mensagem: erro.mensagem });
        else this.erro.set(textoDoErro(erro, 'Erro ao excluir estado.'));
      }
    });
  }

  desativar() {
    const e = this.bloqueio()?.estado;
    if (!e) return;
    this.agindo.set(e.id);
    this.service.atualizar(e.id, {
      nome: e.nome, notaEc: e.notaEc, notaVidaRemanescente: e.notaVidaRemanescente, ativo: false
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Estado "${e.nome}" inativado.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao inativar estado.'), 'Erro ao inativar estado.'));
      }
    });
  }

  // ---- histórico ----

  abrirHistorico(e: ImobEstadoConservacao) {
    this.histEstado.set(e);
    this.histItens.set([]);
    this.histTotal.set(0);
    this.histErro.set('');
    this.histModal ??= new Modal(this.histEl().nativeElement);
    this.histModal.show();
    this.carregarHistorico(1);
  }

  carregarHistorico(page: number) {
    const e = this.histEstado();
    if (!e) return;
    this.histLoading.set(true);
    this.histErro.set('');
    this.service.historico(e.id, page, HIST_PAGE_SIZE).subscribe({
      next: res => {
        this.histItens.set(res.items);
        this.histTotal.set(res.total);
        this.histPage.set(page);
        this.histLoading.set(false);
      },
      error: err => {
        this.histErro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar o histórico.'), 'Erro ao carregar o histórico.'));
        this.histLoading.set(false);
      }
    });
  }

  rotuloCampo(campo: string): string {
    return ROTULO_CAMPO_HISTORICO_ESTADO[campo] ?? campo;
  }

  /** `ativo` vem como true/false em texto; os demais campos são mostrados como o servidor devolveu. */
  valorHistorico(campo: string, valor: string | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (campo === 'ativo') return valor.toLowerCase() === 'true' ? 'Ativo' : 'Inativo';
    return valor;
  }

  erroCampo(nome: 'nome' | 'notaEc' | 'notaVidaRemanescente'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return 'Máximo de 100 caracteres.';
    if (c.errors?.['min'] || c.errors?.['max']) return 'Informe uma nota de 0 a 10.';
    if (c.errors?.['casas']) return 'Use no máximo 2 casas decimais.';
    return '';
  }
}
