import { Component, computed, effect, inject, OnInit, OnDestroy, untracked } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { PermissaoService } from '../../core/services/permissao.service';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { EmpresaPerfilService } from '../../core/services/empresa-perfil.service';
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
  empresa = inject(EmpresaAtivaService);
  version = inject(VersionService);
  perfilEmpresa = inject(EmpresaPerfilService);
  private router = inject(Router);

  /** Imobilizado no menu: só com o módulo liberado na empresa ativa. */
  mostrarImobilizado = computed(() => this.empresa.temModulo('imobilizado'));
  /** Estoque no menu: módulo liberado e perfil que o usa (contador não usa). */
  mostrarEstoque = computed(() => this.empresa.temModulo('estoque') && this.permissao.podeUsarEstoque());
  private routerSub?: Subscription;

  /** Logo no topo do menu: recarrega ao trocar a empresa ativa; 404 ou erro = sem logo (ícone padrão). */
  private carregaLogo = effect(() => {
    const id = this.empresa.id();
    untracked(() => {
      if (id === null) this.perfilEmpresa.definirLogo(null);
      else this.perfilEmpresa.carregarLogo().subscribe();
    });
  });

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
