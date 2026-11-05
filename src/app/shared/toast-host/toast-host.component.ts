import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1100"
         aria-live="polite" aria-atomic="false">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast show align-items-center border-0 text-bg-{{ cor(t.tipo) }}"
             [attr.role]="t.tipo === 'erro' ? 'alert' : 'status'">
          <div class="d-flex">
            <div class="toast-body">{{ t.texto }}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"
                    aria-label="Fechar" (click)="toastService.fechar(t.id)"></button>
          </div>
        </div>
      }
    </div>
  `
})
export class ToastHostComponent {
  toastService = inject(ToastService);

  cor(tipo: 'sucesso' | 'erro' | 'info'): string {
    return tipo === 'sucesso' ? 'success' : tipo === 'erro' ? 'danger' : 'primary';
  }
}
