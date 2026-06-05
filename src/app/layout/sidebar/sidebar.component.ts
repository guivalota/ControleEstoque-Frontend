import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { PermissaoService } from '../../core/services/permissao.service';
import { VersionService } from '../../core/services/version.service';
import { Offcanvas } from 'bootstrap';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  permissao = inject(PermissaoService);
  version = inject(VersionService);
  private router = inject(Router);
  private routerSub?: Subscription;

  ngOnInit() {
    this.version.carregar();
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        const el = document.getElementById('sidebarOffcanvas');
        if (el) Offcanvas.getInstance(el)?.hide();
      });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }
}
