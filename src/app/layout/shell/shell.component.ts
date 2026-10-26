import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { PermissaoService } from '../../core/services/permissao.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  permissao = inject(PermissaoService);
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  /** No Imobilizado vale o perfil na empresa ativa; no resto, a role global. */
  somenteLeitura = computed(() =>
    this.url().startsWith('/imobilizado')
      ? this.permissao.perfilImob() === 'leitura'
      : this.permissao.role() === 'leitura'
  );
}
