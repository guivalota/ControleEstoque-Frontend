import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlataformaEquipeService } from '../../../core/services/plataforma-equipe.service';
import { EquipeEvento, EquipeMembro, PerfilEquipe } from '../../../core/models/plataforma-equipe.model';
import { AJUDA_PERFIS, PERFIS_IMOB, ROTULO_PERFIL } from '../../../core/models/imob-empresa.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

const PAGE_SIZE = 20;

/** Aba "Equipe" da empresa no painel do super admin: criar, perfil inline, redefinir senha, ativar/desativar, histórico. */
@Component({
  selector: 'app-empresa-equipe',
  standalone: true,
  imports: [ReactiveFormsModule, SenhaProvisoriaModalComponent, ConfirmDialogComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h6 class="fw-bold mb-0">Equipe</h6>
      <button type="button" class="btn btn-primary btn-sm" (click)="novo.set(!novo())">
        <i class="bi bi-person-plus me-1"></i>Novo membro
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
          <div class="col-md-4">
            <label for="eqNome" class="form-label small mb-1">Nome *</label>
            <input id="eqNome" class="form-control form-control-sm" formControlName="nome" maxlength="255"
                   [class.is-invalid]="invalido('nome')">
            <div class="invalid-feedback">{{ msg('nome') }}</div>
          </div>
          <div class="col-md-4">
            <label for="eqEmail" class="form-label small mb-1">E-mail *</label>
            <input id="eqEmail" type="email" class="form-control form-control-sm" formControlName="email" maxlength="255"
                   [class.is-invalid]="invalido('email')">
            <div class="invalid-feedback">{{ msg('email') }}</div>
          </div>
          <div class="col-md-2">
            <label for="eqPerfil" class="form-label small mb-1">Perfil *</label>
            <select id="eqPerfil" class="form-select form-select-sm" formControlName="perfil">
              @for (p of perfis; track p) { <option [value]="p">{{ rotulo[p] }}</option> }
            </select>
            <div class="form-text">{{ ajudaPerfis }}</div>
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

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (erroLista()) {
          <div class="alert alert-danger d-flex justify-content-between align-items-center m-3 py-2" role="alert">
            <span>{{ erroLista() }}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th class="ps-3">Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th class="text-end pe-3">Ações</th></tr>
              </thead>
              <tbody>
                @for (m of membros(); track m.usuarioId) {
                  <tr>
                    <td class="ps-3">{{ m.nome }}</td>
                    <td>{{ m.email }}</td>
                    <td>
                      <select class="form-select form-select-sm w-auto" [value]="m.perfil" [disabled]="agindo() === m.usuarioId"
                              [attr.aria-label]="'Perfil de ' + m.nome" (change)="alterarPerfil(m, $any($event.target).value, $any($event.target))">
                        @for (p of perfis; track p) { <option [value]="p" [selected]="p === m.perfil">{{ rotulo[p] }}</option> }
                      </select>
                    </td>
                    <td>
                      <span class="badge" [class.bg-success-subtle]="m.ativo" [class.text-success]="m.ativo"
                            [class.bg-secondary-subtle]="!m.ativo" [class.text-secondary]="!m.ativo">{{ m.ativo ? 'Ativo' : 'Inativo' }}</span>
                    </td>
                    <td class="text-end pe-3 text-nowrap">
                      <button type="button" class="btn btn-sm btn-outline-secondary me-1" [disabled]="agindo() === m.usuarioId"
                              (click)="redefinirSenha(m)" title="Redefinir senha" [attr.aria-label]="'Redefinir senha de ' + m.nome">
                        <i class="bi bi-key"></i>
                      </button>
                      <button type="button" class="btn btn-sm" [class.btn-outline-warning]="m.ativo" [class.btn-outline-success]="!m.ativo"
                              [disabled]="agindo() === m.usuarioId" (click)="alternarAtivo(m)"
                              [title]="m.ativo ? 'Desativar' : 'Ativar'" [attr.aria-label]="(m.ativo ? 'Desativar ' : 'Ativar ') + m.nome">
                        <i class="bi" [class.bi-slash-circle]="m.ativo" [class.bi-check-circle]="!m.ativo"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-muted py-4">Nenhum membro na equipe.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <h6 class="fw-bold">Histórico da equipe</h6>
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (erroEventos()) {
          <div class="alert alert-danger m-3 py-2" role="alert">{{ erroEventos() }}</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 small">
              <thead class="table-light">
                <tr><th class="ps-3">Data/hora</th><th>Ação</th><th>Ator</th><th>Usuário</th><th>Detalhe</th></tr>
              </thead>
              <tbody>
                @for (e of eventos(); track e.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(e.criadoEm) }}</td>
                    <td>{{ e.acao }}</td>
                    <td>{{ e.atorNome }}</td>
                    <td>{{ e.alvoNome }}</td>
                    <td class="text-muted">{{ e.detalhe || '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-muted py-3">Sem eventos.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ totalEventos() }} evento(s)</span>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="pagina() === 1"
                      (click)="carregarEventos(pagina() - 1)">Anterior</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="pagina() * pageSize >= totalEventos()"
                      (click)="carregarEventos(pagina() + 1)">Próxima</button>
            </div>
          </div>
        }
      </div>
    </div>

    <app-senha-provisoria-modal />
    <app-confirm-dialog />
  `
})
export class EmpresaEquipeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaEquipeService);
  private senhaModal = viewChild.required(SenhaProvisoriaModalComponent);
  private confirmar = viewChild.required(ConfirmDialogComponent);

  empresaId = input.required<number>();

  readonly perfis: PerfilEquipe[] = PERFIS_IMOB;
  readonly rotulo = ROTULO_PERFIL;
  readonly ajudaPerfis = AJUDA_PERFIS;
  readonly pageSize = PAGE_SIZE;
  formatarDataHora = formatarDataHora;

  membros = signal<EquipeMembro[]>([]);
  eventos = signal<EquipeEvento[]>([]);
  totalEventos = signal(0);
  pagina = signal(1);
  loading = signal(false);
  salvando = signal(false);
  agindo = signal<string | null>(null);
  novo = signal(false);
  erro = signal('');
  erroLista = signal('');
  erroEventos = signal('');
  feedback = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    perfil: ['leitura' as PerfilEquipe, Validators.required]
  });

  ngOnInit() {
    this.carregar();
    this.carregarEventos(1);
  }

  carregar() {
    this.loading.set(true);
    this.erroLista.set('');
    this.service.listar(this.empresaId()).subscribe({
      next: m => { this.membros.set(m); this.loading.set(false); },
      error: err => { this.erroLista.set(lerErroApi(err, 'Erro ao carregar a equipe.').mensagem); this.loading.set(false); }
    });
  }

  carregarEventos(page: number) {
    this.erroEventos.set('');
    this.service.eventos(this.empresaId(), page, PAGE_SIZE).subscribe({
      next: r => { this.eventos.set(r.items); this.totalEventos.set(r.total); this.pagina.set(page); },
      error: err => this.erroEventos.set(lerErroApi(err, 'Erro ao carregar o histórico.').mensagem)
    });
  }

  criar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.salvando.set(true);
    this.erro.set('');
    const v = this.form.getRawValue();
    this.service.criar(this.empresaId(), { nome: v.nome!.trim(), email: v.email!.trim(), perfil: v.perfil! }).subscribe({
      next: res => {
        this.salvando.set(false);
        this.novo.set(false);
        this.form.reset({ nome: '', email: '', perfil: 'leitura' });
        this.senhaModal().abrir({
          titulo: 'Membro criado',
          descricao: `${res.usuario.nome} (${res.usuario.email}) foi adicionado à equipe.`,
          senha: res.senhaProvisoria
        });
        this.carregar();
        this.carregarEventos(1);
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao criar o membro.'), { email: ['e-mail', 'email'] }));
      }
    });
  }

  alterarPerfil(m: EquipeMembro, perfil: PerfilEquipe, select?: HTMLSelectElement) {
    if (perfil === m.perfil) return;
    this.agindo.set(m.usuarioId);
    this.erro.set('');
    this.feedback.set('');
    this.service.alterarPerfil(this.empresaId(), m.usuarioId, perfil).subscribe({
      next: () => {
        this.agindo.set(null);
        this.membros.update(l => l.map(x => x.usuarioId === m.usuarioId ? { ...x, perfil } : x));
        this.feedback.set(`Perfil de ${m.nome} alterado para ${ROTULO_PERFIL[perfil]}.`);
        this.carregarEventos(1);
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao alterar o perfil.').mensagem);
        if (select) select.value = m.perfil; // volta o select ao valor do servidor
      }
    });
  }

  async redefinirSenha(m: EquipeMembro) {
    const ok = await this.confirmar().abrir({
      titulo: 'Redefinir senha',
      mensagem: `Gerar nova senha provisória para ${m.nome}? As sessões atuais serão encerradas.`,
      confirmar: 'Redefinir'
    });
    if (!ok) return;
    this.agindo.set(m.usuarioId);
    this.erro.set('');
    this.service.redefinirSenha(this.empresaId(), m.usuarioId).subscribe({
      next: res => {
        this.agindo.set(null);
        this.senhaModal().abrir({
          titulo: 'Senha redefinida',
          descricao: `Nova senha provisória de ${m.nome} (${m.email}).`,
          senha: res.senhaProvisoria
        });
        this.carregarEventos(1);
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao redefinir a senha.').mensagem);
      }
    });
  }

  async alternarAtivo(m: EquipeMembro) {
    const ativar = !m.ativo;
    if (!ativar) {
      const ok = await this.confirmar().abrir({
        titulo: 'Desativar usuário',
        mensagem: `Desativar ${m.nome}? Ele perde o acesso a esta empresa.`,
        confirmar: 'Desativar',
        perigo: true
      });
      if (!ok) return;
    }
    this.agindo.set(m.usuarioId);
    this.erro.set('');
    this.service.definirAtivo(this.empresaId(), m.usuarioId, ativar).subscribe({
      next: () => {
        this.agindo.set(null);
        this.membros.update(l => l.map(x => x.usuarioId === m.usuarioId ? { ...x, ativo: ativar } : x));
        this.carregarEventos(1);
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
