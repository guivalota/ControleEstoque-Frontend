import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';

/**
 * Cria o administrador inicial da empresa. A senha provisória é exibida UMA vez no modal compartilhado
 * (`SenhaProvisoriaModal`) depois que o formulário fecha; nunca é persistida.
 */
@Component({
  selector: 'app-plataforma-admin-inicial',
  standalone: true,
  imports: [ReactiveFormsModule, SenhaProvisoriaModalComponent],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plAdminTitulo" aria-hidden="true"
         data-bs-backdrop="static" (hidden.bs.modal)="aoFechar()">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="plAdminTitulo">Criar administrador inicial</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="criar()" novalidate>
            <div class="modal-body">
              @if (erro()) {
                <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div>
              }
              <p class="small text-muted">Empresa: <strong>{{ empresa()?.razaoSocial }}</strong></p>
              <div class="mb-3">
                <label for="plAdminNome" class="form-label">Nome *</label>
                <input id="plAdminNome" class="form-control" formControlName="nome" maxlength="255"
                       [class.is-invalid]="invalido('nome')">
                <div class="invalid-feedback">{{ msg('nome') }}</div>
              </div>
              <div class="mb-3">
                <label for="plAdminEmail" class="form-label">E-mail *</label>
                <input id="plAdminEmail" type="email" class="form-control" formControlName="email" maxlength="255"
                       [class.is-invalid]="invalido('email')">
                <div class="invalid-feedback">{{ msg('email') }}</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                Criar administrador
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <app-senha-provisoria-modal (fechado)="aoFecharSenha()" />
  `
})
export class PlataformaAdminInicialComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaEmpresaService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private senhaModal = viewChild.required(SenhaProvisoriaModalComponent);
  private modal?: Modal;

  /** Emitido ao fechar o modal da senha depois de criar o administrador (para atualizar telas). */
  criado = output<void>();

  empresa = signal<PlataformaEmpresa | null>(null);
  saving = signal(false);
  erro = signal('');
  /** Senha recém-criada, mantida só até o formulário terminar de fechar; então vai ao modal de senha. */
  private pendente: { email: string; senha: string } | null = null;

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
  });

  ngOnDestroy() {
    this.pendente = null;
    this.modal?.dispose();
  }

  abrir(e: PlataformaEmpresa) {
    this.empresa.set(e);
    this.pendente = null;
    this.erro.set('');
    this.form.reset({ nome: '', email: '' });
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  criar() {
    const e = this.empresa();
    if (!e) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.erro.set('');
    const v = this.form.getRawValue();
    this.service.criarAdminInicial(e.id, { nome: v.nome!.trim(), email: v.email!.trim() }).subscribe({
      next: res => {
        this.saving.set(false);
        this.pendente = { email: res.usuario?.email ?? v.email!, senha: res.senhaProvisoria ?? '(não informada pelo servidor)' };
        this.modal?.hide();
      },
      error: err => {
        this.saving.set(false);
        this.erro.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao criar administrador.'), { email: ['e-mail', 'email'] }));
      }
    });
  }

  /** O formulário terminou de fechar: se houve criação, exibe a senha provisória (uma vez). */
  aoFechar() {
    const p = this.pendente;
    this.pendente = null;
    if (!p) return;
    this.senhaModal().abrir({
      titulo: 'Administrador criado',
      descricao: `Administrador ${p.email} criado em ${this.empresa()?.razaoSocial ?? ''}.`,
      senha: p.senha
    });
  }

  aoFecharSenha() {
    this.criado.emit();
  }

  invalido(nome: 'nome' | 'email') {
    const c = this.form.controls[nome];
    return (c.touched || !!c.errors?.['servidor']) && c.invalid;
  }

  msg(nome: 'nome' | 'email'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['email']) return 'E-mail inválido.';
    if (c.errors?.['maxlength']) return 'Máximo de 255 caracteres.';
    return '';
  }
}
