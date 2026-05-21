import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);

  roleBadgeClass(role: string | undefined): string {
    const map: Record<string, string> = {
      admin: 'bg-danger',
      operador: 'bg-primary',
      leitura: 'bg-secondary'
    };
    return map[role ?? ''] ?? 'bg-secondary';
  }

  roleLabel(role: string | undefined): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      operador: 'Operador',
      leitura: 'Somente leitura'
    };
    return map[role ?? ''] ?? (role ?? '');
  }
}
