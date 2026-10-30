import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';

/** Modal de bloquear (motivo obrigatório, até 300) ou desbloquear (motivo opcional) uma empresa. */
@Component({
  selector: 'app-plataforma-bloqueio-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plBloqTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" [formGroup]="form" (ngSubmit)="confirmar()" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="plBloqTitulo">{{ bloquear() ? 'Bloquear empresa' : 'Desbloquear empresa' }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (erro()) {
              <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div>
            }
            <p class="mb-2">
              @if (bloquear()) {
                Bloquear <strong>{{ empresa()?.razaoSocial }}</strong>? Todos os usuários vinculados perdem o acesso; os dados ficam intactos.
              } @else {
                Desbloquear <strong>{{ empresa()?.razaoSocial }}</strong>? Os usuários voltam a acessar com os dados intactos.
              }
            </p>
            <label for="plBloqMotivo" class="form-label">Motivo{{ bloquear() ? ' *' : ' (opcional)' }}</label>
            <textarea id="plBloqMotivo" class="form-control" rows="3" maxlength="300" formControlName="motivo"
                      [class.is-invalid]="invalido()"></textarea>
            <div class="invalid-feedback">{{ msg() }}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn" [class.btn-danger]="bloquear()" [class.btn-success]="!bloquear()" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              {{ bloquear() ? 'Bloquear' : 'Desbloquear' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class PlataformaBloqueioModalComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaEmpresaService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;

  /** Emite a empresa atualizada e se foi bloqueio. */
  concluido = output<{ empresa: PlataformaEmpresa; bloqueou: boolean }>();

  empresa = signal<PlataformaEmpresa | null>(null);
  bloquear = signal(true);
  saving = signal(false);
  erro = signal('');

  form = this.fb.group({ motivo: ['', [Validators.maxLength(300)]] });

  ngOnDestroy() {
    this.modal?.dispose();
  }

  /** Bloqueia se a empresa está ativa; desbloqueia se está bloqueada. */
  abrir(e: PlataformaEmpresa) {
    this.empresa.set(e);
    this.bloquear.set(e.ativo);
    const motivo = this.form.controls.motivo;
    motivo.setValidators(e.ativo ? [Validators.required, Validators.maxLength(300)] : [Validators.maxLength(300)]);
    motivo.updateValueAndValidity();
    this.form.reset({ motivo: '' });
    this.erro.set('');
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  confirmar() {
    const e = this.empresa();
    if (!e) return;
    const motivo = (this.form.controls.motivo.value ?? '').trim();
    if (this.bloquear() && !motivo) { this.form.controls.motivo.setValue(''); this.form.markAllAsTouched(); return; }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.erro.set('');
    const bloqueou = this.bloquear();
    const op = bloqueou ? this.service.bloquear(e.id, motivo) : this.service.desbloquear(e.id, motivo || null);
    op.subscribe({
      next: empresa => {
        this.saving.set(false);
        this.modal?.hide();
        this.concluido.emit({ empresa, bloqueou });
      },
      error: err => {
        this.saving.set(false);
        this.erro.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao alterar a situação da empresa.'), {}));
      }
    });
  }

  invalido() {
    const c = this.form.controls.motivo;
    return (c.touched || !!c.errors?.['servidor']) && c.invalid;
  }

  msg(): string {
    const c = this.form.controls.motivo;
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (c.errors?.['required']) return 'Informe o motivo do bloqueio.';
    if (c.errors?.['maxlength']) return 'Máximo de 300 caracteres.';
    return '';
  }
}
