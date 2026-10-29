import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaVinculoService } from '../../../core/services/plataforma-vinculo.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { ImobPerfil, PERFIS_IMOB, ROTULO_PERFIL } from '../../../core/models/imob-empresa.model';
import { User } from '../../../core/models/user.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarCnpj } from '../../../core/utils/cnpj';

/**
 * Nova conta de suporte (tipo `plataforma`) vinculada a uma empresa (D-035): `POST v1/users` e em seguida
 * `POST v1/plataforma/empresas/{id}/usuarios`.
 */
@Component({
  selector: 'app-conta-nova',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="card border-0 shadow-sm mb-3" [formGroup]="form" (ngSubmit)="salvar()" novalidate>
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="fw-bold mb-0">Nova conta de plataforma (suporte)</h6>
          <button type="button" class="btn-close" aria-label="Fechar" (click)="fechar.emit()"></button>
        </div>
        @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }
        <div class="row g-2">
          <div class="col-md-4">
            <label for="cnNome" class="form-label small mb-1">Nome *</label>
            <input id="cnNome" class="form-control form-control-sm" formControlName="nome" maxlength="255" [class.is-invalid]="invalido('nome')">
            <div class="invalid-feedback">{{ msg('nome') }}</div>
          </div>
          <div class="col-md-4">
            <label for="cnEmail" class="form-label small mb-1">E-mail *</label>
            <input id="cnEmail" type="email" class="form-control form-control-sm" formControlName="email" maxlength="255" [class.is-invalid]="invalido('email')">
            <div class="invalid-feedback">{{ msg('email') }}</div>
          </div>
          <div class="col-md-4">
            <label for="cnSenha" class="form-label small mb-1">Senha *</label>
            <input id="cnSenha" type="password" class="form-control form-control-sm" formControlName="senha" autocomplete="new-password" [class.is-invalid]="invalido('senha')">
            <div class="invalid-feedback">{{ msg('senha') }}</div>
          </div>
          <div class="col-md-4">
            <label for="cnEmpresa" class="form-label small mb-1">Empresa *</label>
            <select id="cnEmpresa" class="form-select form-select-sm" formControlName="empresaId" [class.is-invalid]="invalido('empresaId')">
              <option [ngValue]="null">Selecione...</option>
              @for (e of empresas(); track e.id) { <option [ngValue]="e.id">{{ e.nomeFantasia || e.razaoSocial }} ({{ cnpj(e.cnpj) }})</option> }
            </select>
            <div class="invalid-feedback">{{ msg('empresaId') }}</div>
          </div>
          <div class="col-md-3">
            <label for="cnPerfil" class="form-label small mb-1">Perfil na empresa</label>
            <select id="cnPerfil" class="form-select form-select-sm" formControlName="perfil">
              @for (p of perfis; track p) { <option [value]="p">{{ rotuloPerfil[p] }}</option> }
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button type="submit" class="btn btn-primary btn-sm w-100" [disabled]="salvando()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Criar
            </button>
          </div>
        </div>
        <small class="text-muted d-block mt-2">A senha precisa ter 8+ caracteres com maiúscula, minúscula, número e símbolo.</small>
      </div>
    </form>
  `
})
export class ContaNovaComponent {
  private fb = inject(FormBuilder);
  private users = inject(UserService);
  private vinculo = inject(PlataformaVinculoService);
  private empresasService = inject(PlataformaEmpresaService);

  criada = output<string>();
  fechar = output<void>();

  perfis = PERFIS_IMOB;
  rotuloPerfil = ROTULO_PERFIL;
  cnpj = formatarCnpj;

  empresas = signal<PlataformaEmpresa[]>([]);
  salvando = signal(false);
  erro = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    senha: ['', [Validators.required]],
    empresaId: [null as number | null, [Validators.required]],
    perfil: ['operador' as ImobPerfil]
  });

  constructor() {
    this.empresasService.listar(1, 100).subscribe({
      next: r => this.empresas.set(r.items),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar as empresas.'), 'Erro ao carregar as empresas.'))
    });
  }

  invalido(c: string) {
    const ctl = this.form.get(c);
    return !!ctl && ctl.invalid && (ctl.touched || ctl.dirty);
  }

  msg(c: string) {
    const ctl = this.form.get(c);
    if (ctl?.hasError('required')) return 'Campo obrigatório.';
    if (ctl?.hasError('email')) return 'E-mail inválido.';
    return (ctl?.errors?.['servidor'] as string) ?? 'Valor inválido.';
  }

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.erro.set('');
    this.salvando.set(true);
    // role global da conta de suporte = perfil escolhido (o vínculo só restringe, nunca excede a role)
    this.users.criarConta({ nome: v.nome!.trim(), email: v.email!.trim(), senha: v.senha!, role: v.perfil! }).subscribe({
      next: (u: User) => this.vincular(u, v.empresaId!, v.perfil!),
      error: err => this.falha(err)
    });
  }

  private vincular(u: User, empresaId: number, perfil: ImobPerfil) {
    this.vinculo.vincular(empresaId, u.id, perfil).subscribe({
      next: () => { this.salvando.set(false); this.criada.emit(`Conta ${u.email} criada e vinculada.`); },
      error: err => {
        this.falha(err);
        this.erro.update(m => `${m} A conta ${u.email} foi criada, mas não foi vinculada: use "Vínculo" na lista de contas.`);
      }
    });
  }

  private falha(err: unknown) {
    const e = lerErroApi(err, 'Não foi possível criar a conta.');
    aplicarErroNoForm(this.form, e);
    this.erro.set(textoDoErro(e, 'Não foi possível criar a conta.'));
    this.salvando.set(false);
  }
}
