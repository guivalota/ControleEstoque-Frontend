import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlataformaSuperAdminService } from '../../../core/services/plataforma-super-admin.service';
import { SuperAdmin } from '../../../core/models/plataforma-super-admin.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

/** Super administradores: criar, redefinir senha e ativar/desativar. Erros do servidor (último SA, própria conta) são exibidos como vêm. */
@Component({
  selector: 'app-plataforma-super-admins',
  standalone: true,
  imports: [ReactiveFormsModule, SenhaProvisoriaModalComponent, ConfirmDialogComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0">Super administradores</h5>
      <button type="button" class="btn btn-primary btn-sm" (click)="novo.set(!novo())">
        <i class="bi bi-person-plus me-1"></i>Novo super admin
      </button>
    </div>

    @if (feedback()) {
      <div class="alert alert-success alert-dismissible py-2" role="status">
        {{ feedback() }}
        <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
      </div>
    }
    @if (erro()) {
      <div class="alert alert-danger alert-dismissible py-2" role="alert">
        {{ erro() }}
        <button type="button" class="btn-close" aria-label="Fechar" (click)="erro.set('')"></button>
      </div>
    }

    @if (novo()) {
      <form class="card card-body border-0 shadow-sm mb-3" [formGroup]="form" (ngSubmit)="criar()" novalidate>
        <div class="row g-2 align-items-start">
          <div class="col-md-5">
            <label for="saNome" class="form-label small mb-1">Nome *</label>
            <input id="saNome" class="form-control form-control-sm" formControlName="nome" maxlength="255" [class.is-invalid]="invalido('nome')">
            <div class="invalid-feedback">{{ msg('nome') }}</div>
          </div>
          <div class="col-md-5">
            <label for="saEmail" class="form-label small mb-1">E-mail *</label>
            <input id="saEmail" type="email" class="form-control form-control-sm" formControlName="email" maxlength="255" [class.is-invalid]="invalido('email')">
            <div class="invalid-feedback">{{ msg('email') }}</div>
          </div>
          <div class="col-md-2 d-flex align-items-end" style="min-height: 52px">
            <button type="submit" class="btn btn-primary btn-sm w-100" [disabled]="salvando()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Criar
            </button>
          </div>
        </div>
      </form>
    }

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (erroLista()) {
          <div class="alert alert-danger d-flex justify-content-between align-items-center m-3 py-2" role="alert">
            <span>{{ erroLista() }}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th class="ps-3">Nome</th><th>E-mail</th><th>Situação</th><th>Criado em</th><th class="text-end pe-3">Ações</th></tr>
              </thead>
              <tbody>
                @for (s of lista(); track s.id) {
                  <tr>
                    <td class="ps-3">{{ s.nome }}</td>
                    <td>{{ s.email }}</td>
                    <td>
                      <span class="badge" [class.bg-success-subtle]="s.ativo" [class.text-success]="s.ativo"
                            [class.bg-secondary-subtle]="!s.ativo" [class.text-secondary]="!s.ativo">{{ s.ativo ? 'Ativo' : 'Inativo' }}</span>
                    </td>
                    <td class="text-nowrap">{{ formatarDataHora(s.criadoEm) }}</td>
                    <td class="text-end pe-3 text-nowrap">
                      <button type="button" class="btn btn-sm btn-outline-secondary me-1" [disabled]="agindo() === s.id"
                              (click)="redefinirSenha(s)" title="Redefinir senha" [attr.aria-label]="'Redefinir senha de ' + s.nome">
                        <i class="bi bi-key"></i>
                      </button>
                      <button type="button" class="btn btn-sm" [class.btn-outline-warning]="s.ativo" [class.btn-outline-success]="!s.ativo"
                              [disabled]="agindo() === s.id" (click)="alternarAtivo(s)"
                              [title]="s.ativo ? 'Desativar' : 'Ativar'" [attr.aria-label]="(s.ativo ? 'Desativar ' : 'Ativar ') + s.nome">
                        <i class="bi" [class.bi-slash-circle]="s.ativo" [class.bi-check-circle]="!s.ativo"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-muted py-4">Nenhum super administrador.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <app-senha-provisoria-modal />
    <app-confirm-dialog />
  `
})
export class PlataformaSuperAdminsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaSuperAdminService);
  private senhaModal = viewChild.required(SenhaProvisoriaModalComponent);
  private confirmar = viewChild.required(ConfirmDialogComponent);

  formatarDataHora = formatarDataHora;

  lista = signal<SuperAdmin[]>([]);
  loading = signal(false);
  salvando = signal(false);
  agindo = signal<string | null>(null);
  novo = signal(false);
  erro = signal('');
  erroLista = signal('');
  feedback = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erroLista.set('');
    this.service.listar().subscribe({
      next: l => { this.lista.set(l); this.loading.set(false); },
      error: err => { this.erroLista.set(lerErroApi(err, 'Erro ao carregar os super administradores.').mensagem); this.loading.set(false); }
    });
  }

  criar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.salvando.set(true);
    this.erro.set('');
    const v = this.form.getRawValue();
    this.service.criar({ nome: v.nome!.trim(), email: v.email!.trim() }).subscribe({
      next: res => {
        this.salvando.set(false);
        this.novo.set(false);
        this.form.reset({ nome: '', email: '' });
        this.senhaModal().abrir({
          titulo: 'Super administrador criado',
          descricao: `${res.superAdmin.nome} (${res.superAdmin.email}) foi criado.`,
          senha: res.senhaProvisoria
        });
        this.carregar();
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao criar o super administrador.'), {}));
      }
    });
  }

  async redefinirSenha(s: SuperAdmin) {
    const ok = await this.confirmar().abrir({
      titulo: 'Redefinir senha',
      mensagem: `Gerar nova senha provisória para ${s.nome}? As sessões atuais serão encerradas.`,
      confirmar: 'Redefinir'
    });
    if (!ok) return;
    this.agindo.set(s.id);
    this.erro.set('');
    this.service.redefinirSenha(s.id).subscribe({
      next: res => {
        this.agindo.set(null);
        this.senhaModal().abrir({ titulo: 'Senha redefinida', descricao: `Nova senha provisória de ${s.nome} (${s.email}).`, senha: res.senhaProvisoria });
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao redefinir a senha.').mensagem);
      }
    });
  }

  async alternarAtivo(s: SuperAdmin) {
    const ativar = !s.ativo;
    if (!ativar) {
      const ok = await this.confirmar().abrir({
        titulo: 'Desativar super administrador',
        mensagem: `Desativar ${s.nome}? Ele perde o acesso ao painel.`,
        confirmar: 'Desativar',
        perigo: true
      });
      if (!ok) return;
    }
    this.agindo.set(s.id);
    this.erro.set('');
    this.service.definirAtivo(s.id, ativar).subscribe({
      next: () => {
        this.agindo.set(null);
        this.lista.update(l => l.map(x => x.id === s.id ? { ...x, ativo: ativar } : x));
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao alterar a situação.').mensagem);
      }
    });
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
