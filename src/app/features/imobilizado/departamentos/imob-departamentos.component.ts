import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobDepartamentoService } from '../../../core/services/imob-departamento.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobDepartamento } from '../../../core/models/imob-departamento.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';

const PAGE_SIZE = 50;

interface Bloqueio {
  departamento: ImobDepartamento;
  mensagem: string;
}

@Component({
  selector: 'app-imob-departamentos',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ConfirmDialogComponent, PaginacaoComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-departamentos.component.html'
})
export class ImobDepartamentosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobDepartamentoService);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly pageSize = PAGE_SIZE;

  departamentos = signal<ImobDepartamento[]>([]);
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
  bloqueio = signal<Bloqueio | null>(null);

  form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(50)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    ativo: [true]
  });

  ngOnInit() {
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
        this.departamentos.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar departamentos.'), 'Erro ao carregar departamentos.'));
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
    this.form.reset({ codigo: '', nome: '', ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(d: ImobDepartamento) {
    this.editingId.set(d.id);
    this.form.reset({ codigo: d.codigo, nome: d.nome, ativo: d.ativo });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = { codigo: v.codigo!.trim(), nome: v.nome!.trim() };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Departamento atualizado.' : 'Departamento criado.');
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar departamento.'), {
          codigo: ['código', 'codigo'],
          nome: ['nome']
        }));
        this.saving.set(false);
      }
    });
  }

  async excluir(d: ImobDepartamento) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir departamento',
      mensagem: `Excluir o departamento "${d.nome}"? Prefira desativar se ele já foi usado.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(d.id);
    this.bloqueio.set(null);
    this.service.excluir(d.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Departamento excluído.');
        this.carregar(this.departamentos().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        const e = lerErroApi(err, 'Erro ao excluir departamento.');
        if (err.status === 400 && e.mensagem) this.bloqueio.set({ departamento: d, mensagem: e.mensagem });
        else this.erro.set(textoDoErro(e, 'Erro ao excluir departamento.'));
      }
    });
  }

  desativar() {
    const d = this.bloqueio()?.departamento;
    if (!d) return;
    this.agindo.set(d.id);
    this.service.atualizar(d.id, { codigo: d.codigo, nome: d.nome, ativo: false }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Departamento "${d.nome}" desativado.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao desativar departamento.'), 'Erro ao desativar departamento.'));
      }
    });
  }

  bloqueioTemBens(): boolean {
    return !!this.bloqueio()?.mensagem.toLowerCase().includes('bens');
  }

  erroCampo(nome: 'codigo' | 'nome'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return `Máximo de ${nome === 'codigo' ? 50 : 255} caracteres.`;
    return '';
  }
}
