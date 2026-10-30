import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { cnpjValidator, mascararCnpj, normalizarCnpj } from '../../../core/utils/cnpj';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';

/** Modal de criar/editar empresa (razão social, fantasia, CNPJ numérico ou alfanumérico). Bloqueio é feito pelo modal de motivo, não aqui. */
@Component({
  selector: 'app-plataforma-empresa-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plEmpresaTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" [formGroup]="form" (ngSubmit)="salvar()" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="plEmpresaTitulo">{{ editingId() !== null ? 'Editar empresa' : 'Nova empresa' }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (saveError()) {
              <div class="alert alert-danger py-2" role="alert">{{ saveError() }}</div>
            }
            <div class="mb-3">
              <label for="plEmpRazao" class="form-label">Razão social *</label>
              <input id="plEmpRazao" class="form-control" formControlName="razaoSocial" maxlength="255"
                     [class.is-invalid]="erroCampo('razaoSocial')">
              <div class="invalid-feedback">{{ erroCampo('razaoSocial') }}</div>
            </div>
            <div class="mb-3">
              <label for="plEmpFantasia" class="form-label">Nome fantasia</label>
              <input id="plEmpFantasia" class="form-control" formControlName="nomeFantasia" maxlength="255"
                     [class.is-invalid]="erroCampo('nomeFantasia')">
              <div class="invalid-feedback">{{ erroCampo('nomeFantasia') }}</div>
            </div>
            <div class="mb-3">
              <label for="plEmpCnpj" class="form-label">CNPJ *</label>
              <input id="plEmpCnpj" class="form-control text-uppercase" formControlName="cnpj" autocomplete="off"
                     placeholder="00.000.000/0000-00 ou 12.ABC.345/01DE-35" maxlength="18" (input)="onCnpjInput()"
                     [class.is-invalid]="erroCampo('cnpj')" aria-describedby="plEmpCnpjAjuda">
              <div class="invalid-feedback">{{ erroCampo('cnpj') }}</div>
              <div id="plEmpCnpjAjuda" class="form-text">Aceita CNPJ numérico ou alfanumérico; os 2 últimos caracteres são dígitos.</div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class PlataformaEmpresaFormComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaEmpresaService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;

  /** Emite a empresa salva (resposta da API) e a flag de criação. */
  salvo = output<{ empresa: PlataformaEmpresa; criada: boolean }>();

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  form = this.fb.group({
    razaoSocial: ['', [Validators.required, Validators.maxLength(255)]],
    nomeFantasia: ['', [Validators.maxLength(255)]],
    cnpj: ['', [Validators.required, cnpjValidator]],
    ativo: [true]
  });

  ngOnDestroy() {
    this.modal?.dispose();
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  abrir(e?: PlataformaEmpresa) {
    this.editingId.set(e?.id ?? null);
    this.form.reset({
      razaoSocial: e?.razaoSocial ?? '',
      nomeFantasia: e?.nomeFantasia ?? '',
      cnpj: e ? mascararCnpj(e.cnpj) : '',
      ativo: e?.ativo ?? true
    });
    this.saveError.set('');
    this.getModal().show();
  }

  onCnpjInput() {
    const c = this.form.controls.cnpj;
    const mascarado = mascararCnpj(c.value);
    if (mascarado !== c.value) c.setValue(mascarado);
  }

  salvar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const v = this.form.getRawValue();
    const corpo = {
      razaoSocial: v.razaoSocial!.trim(),
      nomeFantasia: v.nomeFantasia?.trim() || null,
      cnpj: normalizarCnpj(v.cnpj)
    };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);
    op.subscribe({
      next: empresa => {
        this.saving.set(false);
        this.getModal().hide();
        this.salvo.emit({ empresa, criada: id === null });
      },
      error: err => {
        const e = lerErroApi(err, 'Erro ao salvar empresa.');
        this.saveError.set(aplicarErroNoForm(this.form, e, { cnpj: ['cnpj'], razaoSocial: ['razão'] }));
        this.saving.set(false);
      }
    });
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
