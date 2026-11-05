import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissaoService } from '../../core/services/permissao.service';

/**
 * Entrada do módulo Financeiro. Por ora só atalhos para o que já existe (cadastros); o painel com vencimentos e
 * saldo previsto entra na US-24-07.
 */
@Component({
  selector: 'app-financeiro-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1 class="h4 mb-3">Financeiro</h1>
    <p class="text-secondary">Contas a pagar e a receber, baixas e fluxo de caixa. Comece pelos cadastros: contas, categorias e centros de custo.</p>
    <div class="row g-3">
      @if (permissao.pode('financeiro.cadastros.ver')) {
        <div class="col-12 col-md-4">
          <a class="card card-body text-decoration-none h-100" routerLink="/financeiro/cadastros">
            <strong><i class="bi bi-journal-text me-2"></i>Cadastros</strong>
            <span class="small text-secondary">Contas (caixa e banco), plano de categorias e centros de custo.</span>
          </a>
        </div>
      }
    </div>
  `
})
export class FinanceiroInicioComponent {
  permissao = inject(PermissaoService);
}
