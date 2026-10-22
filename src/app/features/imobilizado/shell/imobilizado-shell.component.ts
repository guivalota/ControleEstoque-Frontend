import { Component, OnDestroy, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet, ActivatedRouteSnapshot } from '@angular/router';
import { filter } from 'rxjs';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { formatarCnpj } from '../../../core/utils/cnpj';
import { SeletorEmpresaComponent } from './seletor-empresa.component';

@Component({
  selector: 'app-imobilizado-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SeletorEmpresaComponent],
  templateUrl: './imobilizado-shell.component.html'
})
export class ImobilizadoShellComponent implements OnDestroy {
  empresa = inject(EmpresaAtivaService);
  private permissao = inject(PermissaoService);
  private router = inject(Router);

  formatarCnpj = formatarCnpj;
  isAdmin = computed(() => this.permissao.role() === 'admin');

  constructor() {
    this.atualizarModo();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.atualizarModo());
  }

  ngOnDestroy() {
    this.empresa.emAdministracao.set(false);
  }

  /** Telas de administração (data.administracao) funcionam sem empresa ativa. */
  private atualizarModo() {
    let rota: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (rota?.firstChild) rota = rota.firstChild;
    this.empresa.emAdministracao.set(!!rota?.data['administracao']);
  }
}
