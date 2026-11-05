import { Component, computed, effect, inject, OnInit, OnDestroy, signal, untracked } from '@angular/core';
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
  /** Produção no menu: módulo liberado e perfil que usa o Estoque (a Produção consome o Estoque). */
  mostrarProducao = computed(() => this.empresa.temModulo('producao') && this.permissao.podeUsarEstoque());
  private routerSub?: Subscription;

  /** URL atual (sem query), para abrir sozinho o grupo da página em que o usuário está. */
  private url = signal(this.router.url.split('?')[0]);
  /** Escolha manual do usuário por grupo (true = aberto, false = fechado); vale até a navegação cair no grupo. */
  private manual = signal<Record<string, boolean>>({});

  private static readonly ROTAS_GRUPO: Record<string, string> = {
    estoque: '/dashboard,/produtos,/categorias,/grade,/movimentacoes,/lotes,/pedidos-compra,/notas-fiscais,/conferencia',
    producao: '/producao',
    imob: '/imobilizado',
    'imob-cad': '/imobilizado/locais,/imobilizado/categorias,/imobilizado/grupos,/imobilizado/departamentos,/imobilizado/responsaveis',
    'imob-reav': '/imobilizado/reavaliacao'
  };

  /** A URL atual está sob algum dos prefixos (lista separada por vírgula). */
  rotaEm(prefixos: string): boolean {
    const u = this.url();
    return prefixos.split(',').some(p => u === p || u.startsWith(p + '/'));
  }

  aberto(chave: string): boolean {
    return this.manual()[chave] ?? this.rotaEm(SidebarComponent.ROTAS_GRUPO[chave] ?? '');
  }

  alternar(chave: string) {
    this.manual.update(m => ({ ...m, [chave]: !this.aberto(chave) }));
  }

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
        this.url.set(this.router.url.split('?')[0]);
        // ao navegar para dentro de um grupo, a escolha manual anterior deixa de valer
        this.manual.update(m => Object.fromEntries(Object.entries(m).filter(([k]) => !this.rotaEm(SidebarComponent.ROTAS_GRUPO[k] ?? ''))));
        const el = document.getElementById('sidebarOffcanvas');
        if (el) Offcanvas.getInstance(el)?.hide();
      });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }
}
