import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  auth = inject(AuthService);
  permissao = inject(PermissaoService);
  empresa = inject(EmpresaAtivaService);
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  /** O Imobilizado tem shell próprio (sem acesso, administração de empresas). */
  naImobilizado = computed(() => this.url().startsWith('/imobilizado'));

  /** Estado que impede ativar telas de dados (a empresa ativa precisa estar definida antes). */
  bloqueio = computed<'erro' | 'carregando' | 'semAcesso' | null>(() => {
    if (this.naImobilizado()) return null;
    if (this.empresa.erroCarregar()) return 'erro';
    if (!this.empresa.carregado()) return 'carregando';
    if (this.empresa.semAcesso()) return 'semAcesso';
    // Empresa ainda não definida (recarga após perder acesso): trata como carregando.
    if (this.empresa.id() === null) return 'carregando';
    return null;
  });

  /** Chave do outlet: recria as telas de dados ao trocar de empresa (no Imobilizado quem recria é o shell dele). */
  chaveEmpresa = computed(() => this.naImobilizado() ? 0 : this.empresa.id());

  /** Vale o perfil na empresa ativa (a conta cliente tem role global leitura mas o poder vem do vínculo). */
  somenteLeitura = computed(() => this.empresa.ativa() !== null && this.permissao.perfil() === 'leitura');
}
