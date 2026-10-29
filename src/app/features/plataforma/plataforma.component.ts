import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

/** Shell do painel da plataforma (super administrador): cabeçalho + navegação + rotas filhas. */
@Component({
  selector: 'app-plataforma',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="navbar bg-body-tertiary border-bottom px-3">
      <span class="navbar-brand fw-bold mb-0">
        <i class="bi bi-gear-wide-connected text-primary me-2"></i>Painel da plataforma
      </span>
      <div class="d-flex align-items-center gap-2 small">
        <span class="text-muted d-none d-sm-inline">
          <i class="bi bi-person-circle me-1"></i>{{ auth.currentUser()?.nome }}
        </span>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="theme.toggle()"
                [attr.aria-label]="theme.isDark() ? 'Usar tema claro' : 'Usar tema escuro'">
          <i class="bi" [class.bi-sun]="theme.isDark()" [class.bi-moon]="!theme.isDark()"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="auth.logout()">
          <i class="bi bi-box-arrow-right me-1"></i>Sair
        </button>
      </div>
    </header>
    <div class="container-fluid py-3">
      <nav aria-label="Seções da plataforma" class="mb-3">
        <ul class="nav nav-pills gap-1">
          <li class="nav-item">
            <a class="nav-link py-1" routerLink="/plataforma/empresas" routerLinkActive="active">
              <i class="bi bi-buildings me-1"></i>Empresas
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link py-1" routerLink="/plataforma/planos" routerLinkActive="active">
              <i class="bi bi-card-checklist me-1"></i>Planos
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link py-1" routerLink="/plataforma/super-admins" routerLinkActive="active">
              <i class="bi bi-shield-lock me-1"></i>Super admins
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link py-1" routerLink="/plataforma/contas" routerLinkActive="active">
              <i class="bi bi-people me-1"></i>Contas
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link py-1" routerLink="/plataforma/logs" routerLinkActive="active">
              <i class="bi bi-journal-text me-1"></i>Logs
            </a>
          </li>
        </ul>
      </nav>
      <router-outlet />
    </div>
  `
})
export class PlataformaComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
}
