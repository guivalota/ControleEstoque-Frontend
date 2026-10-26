import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Modal } from 'bootstrap';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { ImobEmpresaService } from '../../../core/services/imob-empresa.service';
import { ImobEmpresa } from '../../../core/models/imob-empresa.model';
import { cnpjValidator, formatarCnpj, mascararCnpj } from '../../../core/utils/cnpj';
import { lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-imob-empresas',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent, PaginacaoComponent],
  templateUrl: './imob-empresas.component.html'
})
export class ImobEmpresasComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobEmpresaService);
  private minhasEmpresas = inject(EmpresaAtivaService);
  private router = inject(Router);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly pageSize = PAGE_SIZE;
  formatarCnpj = formatarCnpj;

  empresas = signal<ImobEmpresa[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  agindo = signal<number | null>(null);

  form = this.fb.group({
    razaoSocial: ['', [Validators.required, Validators.maxLength(255)]],
    nomeFantasia: ['', [Validators.maxLength(255)]],
    cnpj: ['', [Validators.required, cnpjValidator]],
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
    this.service.listar(page, PAGE_SIZE).subscribe({
      next: res => {
        this.empresas.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar empresas.').mensagem);
        this.loading.set(false);
      }
    });
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ razaoSocial: '', nomeFantasia: '', cnpj: '', ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(e: ImobEmpresa) {
    this.editingId.set(e.id);
    this.form.reset({
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia ?? '',
      cnpj: mascararCnpj(e.cnpj),
      ativo: e.ativo
    });
    this.saveError.set('');
    this.getModal().show();
  }

  onCnpjInput() {
    const c = this.form.controls.cnpj;
    const mascarado = mascararCnpj(c.value);
    if (mascarado !== c.value) c.setValue(mascarado);
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = {
      razaoSocial: v.razaoSocial!.trim(),
      nomeFantasia: v.nomeFantasia?.trim() || undefined,
      cnpj: v.cnpj!
    };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Empresa atualizada.' : 'Empresa criada. Vincule usuários para liberar o acesso.');
        this.carregar();
        this.minhasEmpresas.carregar().subscribe();
      },
      error: err => {
        const e = lerErroApi(err, 'Erro ao salvar empresa.');
        for (const [campo, msg] of Object.entries(e.campos)) {
          this.form.get(campo)?.setErrors({ servidor: msg });
        }
        this.saveError.set(e.mensagem);
        this.saving.set(false);
      }
    });
  }

  async alternarAtivo(e: ImobEmpresa) {
    const desativar = e.ativo;
    if (desativar) {
      const ok = await this.confirmDialog().abrir({
        titulo: 'Desativar empresa',
        mensagem: `Desativar "${e.razaoSocial}"? Todos os usuários vinculados perdem o acesso imediatamente.`,
        confirmar: 'Desativar',
        perigo: true
      });
      if (!ok) return;
    }
    this.agindo.set(e.id);
    this.service.atualizar(e.id, {
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia ?? undefined,
      cnpj: e.cnpj,
      ativo: !e.ativo
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set(desativar ? 'Empresa desativada.' : 'Empresa ativada.');
        this.carregar();
        this.minhasEmpresas.carregar().subscribe();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao alterar a situação da empresa.').mensagem);
      }
    });
  }

  async excluir(e: ImobEmpresa) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir empresa',
      mensagem: `Excluir "${e.razaoSocial}"? Os usuários vinculados perdem o acesso imediatamente. Para uso cotidiano, prefira desativar.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(e.id);
    this.service.excluir(e.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Empresa excluída.');
        // se a lista ficou vazia numa página > 1, volta uma página
        this.carregar(this.empresas().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
        this.minhasEmpresas.carregar().subscribe();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao excluir empresa.').mensagem);
      }
    });
  }

  usuarios(e: ImobEmpresa) {
    this.router.navigate(['/imobilizado/empresas', e.id, 'usuarios'], { state: { empresa: e } });
  }

  erroCampo(nome: 'razaoSocial' | 'nomeFantasia' | 'cnpj'): string {
    const c = this.form.controls[nome];
    if (!c.touched && !c.errors?.['servidor']) return '';
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return 'Máximo de 255 caracteres.';
    if (c.errors?.['cnpj']) return 'CNPJ inválido (verifique os dígitos).';
    return '';
  }
}
