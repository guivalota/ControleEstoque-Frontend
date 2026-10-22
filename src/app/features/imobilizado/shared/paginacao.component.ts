import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacao',
  standalone: true,
  template: `
    @if (total() > 0) {
      <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top small text-muted">
        <span>Página {{ page() }} de {{ totalPaginas() }} — {{ total() }} registro(s)</span>
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-secondary" [disabled]="page() <= 1 || disabled()"
                  (click)="mudar.emit(page() - 1)" aria-label="Página anterior">
            <i class="bi bi-chevron-left"></i>
          </button>
          <button type="button" class="btn btn-outline-secondary" [disabled]="page() >= totalPaginas() || disabled()"
                  (click)="mudar.emit(page() + 1)" aria-label="Próxima página">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    }
  `
})
export class PaginacaoComponent {
  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();
  disabled = input(false);
  mudar = output<number>();

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
}
