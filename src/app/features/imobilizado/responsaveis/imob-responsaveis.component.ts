import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobResponsavelService } from '../../../core/services/imob-responsavel.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobResponsavel } from '../../../core/models/imob-responsavel.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { rotuloResponsavel } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';

const PAGE_SIZE = 50;

interface Bloqueio {
  responsavel: ImobResponsavel;
  mensagem: string;
}

@Component({
  selector: 'app-imob-responsaveis',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ConfirmDialogComponent, PaginacaoComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-responsaveis.component.html'
})
export class ImobResponsaveisComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobResponsavelService);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly pageSize = PAGE_SIZE;
  rotulo = rotuloResponsavel;

  responsaveis = signal<ImobResponsavel[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  /** Setores já vistos nos resultados (a API não tem endpoint de setores). */
  setores = signal<string[]>([]);

  busca = '';
  setorFiltro = '';
  ativoFiltro: '' | 'true' | 'false' = '';

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  agindo = signal<number | null>(null);
  bloqueio = signal<Bloqueio | null>(null);

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    matricula: ['', [Validators.maxLength(50)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    setor: ['', [Validators.maxLength(100)]],
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
      setor: this.setorFiltro || undefined,
      ativo: this.ativoFiltro === '' ? undefined : this.ativoFiltro === 'true',
      page,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: res => {
        this.responsaveis.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.registrarSetores(res.items);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar responsáveis.').mensagem);
        this.loading.set(false);
      }
    });
  }

  private registrarSetores(itens: ImobResponsavel[]) {
    const atuais = new Map(this.setores().map(s => [s.toLowerCase(), s]));
    for (const r of itens) {
      const s = r.setor?.trim();
      if (s && !atuais.has(s.toLowerCase())) atuais.set(s.toLowerCase(), s);
    }
    this.setores.set([...atuais.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  }

  limparFiltros() {
    this.busca = '';
    this.setorFiltro = '';
    this.ativoFiltro = '';
    this.carregar(1);
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ nome: '', matricula: '', email: '', setor: '', ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(r: ImobResponsavel) {
    this.editingId.set(r.id);
    this.form.reset({
      nome: r.nome, matricula: r.matricula ?? '', email: r.email ?? '', setor: r.setor ?? '', ativo: r.ativo
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
      nome: v.nome!.trim(),
      matricula: v.matricula?.trim() || undefined,
      email: v.email?.trim() || undefined,
      setor: v.setor?.trim() || undefined
    };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Responsável atualizado.' : 'Responsável criado.');
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar responsável.'), {
          matricula: ['matrícula', 'matricula'],
          email: ['e-mail', 'email'],
          nome: ['nome']
        }));
        this.saving.set(false);
      }
    });
  }

  async excluir(r: ImobResponsavel) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir responsável',
      mensagem: `Excluir ${rotuloResponsavel(r)}? Prefira desativar se ele já recebeu bens.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(r.id);
    this.bloqueio.set(null);
    this.service.excluir(r.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Responsável excluído.');
        this.carregar(this.responsaveis().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        const e = lerErroApi(err, 'Erro ao excluir responsável.');
        if (err.status === 400 && e.mensagem) this.bloqueio.set({ responsavel: r, mensagem: e.mensagem });
        else this.erro.set(e.mensagem);
      }
    });
  }

  desativar() {
    const r = this.bloqueio()?.responsavel;
    if (!r) return;
    this.agindo.set(r.id);
    this.service.atualizar(r.id, {
      nome: r.nome,
      matricula: r.matricula ?? undefined,
      email: r.email ?? undefined,
      setor: r.setor ?? undefined,
      ativo: false
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Responsável ${rotuloResponsavel(r)} desativado.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao desativar responsável.').mensagem);
      }
    });
  }

  bloqueioTemBens(): boolean {
    return !!this.bloqueio()?.mensagem.toLowerCase().includes('bens');
  }

  erroCampo(nome: 'nome' | 'matricula' | 'email' | 'setor'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['email']) return 'E-mail inválido.';
    if (c.errors?.['maxlength']) return `Máximo de ${c.errors['maxlength'].requiredLength} caracteres.`;
    return '';
  }
}
