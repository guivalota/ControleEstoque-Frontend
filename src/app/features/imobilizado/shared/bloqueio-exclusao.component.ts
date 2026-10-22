import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Aviso exibido quando a API recusa a exclusão (ex.: "possui bens"): mostra a mensagem do
 * servidor e oferece desativar o cadastro e, quando há bens, abrir a lista de bens filtrada.
 */
@Component({
  selector: 'app-bloqueio-exclusao',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="alert alert-warning" role="alert">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <i class="bi bi-exclamation-triangle me-2"></i>{{ mensagem() }}
          @if (permiteDesativar()) {
            <div class="small mt-1">Você pode desativar o cadastro para deixar de usá-lo em novos lançamentos.</div>
          }
        </div>
        <button type="button" class="btn-close" aria-label="Fechar aviso" (click)="fechar.emit()"></button>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        @if (permiteDesativar()) {
          <button type="button" class="btn btn-sm btn-warning" [disabled]="desativando()" (click)="desativar.emit()">
            @if (desativando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
            Desativar
          </button>
        }
        @if (filtroBens()) {
          <a class="btn btn-sm btn-outline-secondary" routerLink="/imobilizado/bens" [queryParams]="filtroBens()">
            <i class="bi bi-box-arrow-up-right me-1"></i>Ver bens
          </a>
        }
      </div>
    </div>
  `
})
export class BloqueioExclusaoComponent {
  mensagem = input.required<string>();
  permiteDesativar = input(true);
  /** Query params da lista de bens (ex.: { localId: 3 }); `null` oculta o link. */
  filtroBens = input<Record<string, number> | null>(null);
  desativando = input(false);
  desativar = output<void>();
  fechar = output<void>();
}
