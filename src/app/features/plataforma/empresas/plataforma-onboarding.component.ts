import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaPlanoService } from '../../../core/services/plataforma-plano.service';
import { Plano } from '../../../core/models/plataforma-plano.model';
import { cnpjValidator, mascararCnpj, normalizarCnpj } from '../../../core/utils/cnpj';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';

/**
 * Assistente "Nova empresa": empresa + plano + módulos + administrador inicial numa única chamada transacional
 * (`POST empresas/onboarding`). A senha provisória é exibida uma vez no `SenhaProvisoriaModal`.
 */
@Component({
  selector: 'app-plataforma-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, SenhaProvisoriaModalComponent],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plOnbTitulo" aria-hidden="true"
         data-bs-backdrop="static" (hidden.bs.modal)="aoFechar()">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <form class="modal-content" [formGroup]="form" (ngSubmit)="criar()" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="plOnbTitulo">Nova empresa</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (erro()) {
              <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div>
            }
            <h6 class="fw-bold">Empresa</h6>
            <div class="row g-3 mb-3">
              <div class="col-md-7">
                <label for="onbRazao" class="form-label">Razão social *</label>
                <input id="onbRazao" class="form-control" formControlName="razaoSocial" maxlength="255" [class.is-invalid]="invalido('razaoSocial')">
                <div class="invalid-feedback">{{ msg('razaoSocial') }}</div>
              </div>
              <div class="col-md-5">
                <label for="onbCnpj" class="form-label">CNPJ *</label>
                <input id="onbCnpj" class="form-control text-uppercase" formControlName="cnpj" autocomplete="off" maxlength="18"
                       placeholder="00.000.000/0000-00 ou 12.ABC.345/01DE-35" (input)="onCnpjInput()" [class.is-invalid]="invalido('cnpj')">
                <div class="invalid-feedback">{{ msg('cnpj') }}</div>
              </div>
            </div>

            <h6 class="fw-bold">Plano e módulos</h6>
            <div class="row g-3 mb-3">
              <div class="col-md-7">
                <label for="onbPlano" class="form-label">Plano</label>
                <select id="onbPlano" class="form-select" formControlName="planoId">
                  <option value="">Plano padrão</option>
                  @for (p of planos(); track p.id) { <option [value]="p.id">{{ p.nome }}</option> }
                </select>
              </div>
              <div class="col-md-5 d-flex align-items-end">
                <div class="form-check">
                  <input id="onbSync" type="checkbox" class="form-check-input" formControlName="sincronizarModulos">
                  <label for="onbSync" class="form-check-label">Ligar os módulos do plano</label>
                </div>
              </div>
            </div>

            <h6 class="fw-bold">Administrador inicial</h6>
            <div class="row g-3">
              <div class="col-md-6">
                <label for="onbNome" class="form-label">Nome *</label>
                <input id="onbNome" class="form-control" formControlName="adminNome" maxlength="255" [class.is-invalid]="invalido('adminNome')">
                <div class="invalid-feedback">{{ msg('adminNome') }}</div>
              </div>
              <div class="col-md-6">
                <label for="onbEmail" class="form-label">E-mail *</label>
                <input id="onbEmail" type="email" class="form-control" formControlName="adminEmail" maxlength="255" [class.is-invalid]="invalido('adminEmail')">
                <div class="invalid-feedback">{{ msg('adminEmail') }}</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Criar empresa
            </button>
          </div>
        </form>
      </div>
    </div>
    <app-senha-provisoria-modal (fechado)="aoFecharSenha()" />
  `
})
export class PlataformaOnboardingComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaEmpresaService);
  private planoService = inject(PlataformaPlanoService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private senhaModal = viewChild.required(SenhaProvisoriaModalComponent);
  private modal?: Modal;
  private pendente: { empresa: string; email: string; senha: string } | null = null;

  /** Emitido ao fechar o modal da senha, depois da empresa criada. */
  criada = output<{ empresaId: number }>();

  planos = signal<Plano[]>([]);
  saving = signal(false);
  erro = signal('');
  private empresaIdCriada: number | null = null;

  form = this.fb.group({
    razaoSocial: ['', [Validators.required, Validators.maxLength(255)]],
    cnpj: ['', [Validators.required, cnpjValidator]],
    planoId: [''],
    sincronizarModulos: [false],
    adminNome: ['', [Validators.required, Validators.maxLength(255)]],
    adminEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
  });

  ngOnDestroy() {
    this.pendente = null;
    this.modal?.dispose();
  }

  abrir() {
    this.pendente = null;
    this.empresaIdCriada = null;
    this.erro.set('');
    this.form.reset({ razaoSocial: '', cnpj: '', planoId: '', sincronizarModulos: false, adminNome: '', adminEmail: '' });
    this.planoService.listar().subscribe({
      next: l => this.planos.set(l.filter(p => p.ativo)),
      error: () => this.planos.set([])
    });
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  onCnpjInput() {
    const c = this.form.controls.cnpj;
    const m = mascararCnpj(c.value);
    if (m !== c.value) c.setValue(m);
  }

  criar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.erro.set('');
    const v = this.form.getRawValue();
    const planoId = v.planoId ? Number(v.planoId) : null;
    this.service.onboarding({
      razaoSocial: v.razaoSocial!.trim(),
      cnpj: normalizarCnpj(v.cnpj),
      ...(planoId !== null ? { planoId, sincronizarModulos: !!v.sincronizarModulos } : {}),
      admin: { nome: v.adminNome!.trim(), email: v.adminEmail!.trim() }
    }).subscribe({
      next: res => {
        this.saving.set(false);
        this.empresaIdCriada = res.empresaId;
        this.pendente = { empresa: v.razaoSocial!.trim(), email: v.adminEmail!.trim(), senha: res.senhaProvisoria };
        this.modal?.hide();
      },
      error: err => {
        this.saving.set(false);
        this.erro.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao criar a empresa.'), { cnpj: ['cnpj'] }));
      }
    });
  }

  /** O formulário terminou de fechar: se houve criação, exibe a senha provisória (uma vez). */
  aoFechar() {
    const p = this.pendente;
    this.pendente = null;
    if (!p) return;
    this.senhaModal().abrir({
      titulo: 'Empresa criada',
      descricao: `Empresa ${p.empresa} criada. Administrador: ${p.email}.`,
      senha: p.senha
    });
  }

  aoFecharSenha() {
    if (this.empresaIdCriada !== null) this.criada.emit({ empresaId: this.empresaIdCriada });
    this.empresaIdCriada = null;
  }

  invalido(nome: 'razaoSocial' | 'cnpj' | 'adminNome' | 'adminEmail') {
    const c = this.form.controls[nome];
    return (c.touched || !!c.errors?.['servidor']) && c.invalid;
  }

  msg(nome: 'razaoSocial' | 'cnpj' | 'adminNome' | 'adminEmail'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['email']) return 'E-mail inválido.';
    if (c.errors?.['cnpj']) return 'CNPJ inválido (verifique os dígitos).';
    if (c.errors?.['maxlength']) return 'Máximo de 255 caracteres.';
    return '';
  }
}
