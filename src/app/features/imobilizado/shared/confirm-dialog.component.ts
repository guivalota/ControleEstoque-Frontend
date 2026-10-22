import { Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';
import { Modal } from 'bootstrap';

export interface ConfirmConfig {
  titulo: string;
  mensagem: string;
  confirmar?: string;
  perigo?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="confirmTitulo" aria-hidden="true"
         (hidden.bs.modal)="fechou()">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="confirmTitulo">{{ cfg().titulo }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">{{ cfg().mensagem }}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn" [class.btn-danger]="cfg().perigo" [class.btn-primary]="!cfg().perigo"
                    (click)="confirmar()">{{ cfg().confirmar ?? 'Confirmar' }}</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent implements OnDestroy {
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;
  private resolver?: (ok: boolean) => void;

  cfg = signal<ConfirmConfig>({ titulo: '', mensagem: '' });

  /** Abre o diálogo e resolve `true` ao confirmar, `false` ao cancelar/fechar. */
  abrir(cfg: ConfirmConfig): Promise<boolean> {
    this.cfg.set(cfg);
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.modal!.show();
    });
  }

  confirmar() {
    this.resolver?.(true);
    this.resolver = undefined;
    this.modal?.hide();
  }

  fechou() {
    this.resolver?.(false);
    this.resolver = undefined;
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }
}
