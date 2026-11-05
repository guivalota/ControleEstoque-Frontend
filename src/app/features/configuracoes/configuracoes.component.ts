import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Permissao } from '../../core/models/permissoes';
import { PermissaoService } from '../../core/services/permissao.service';

export interface AbaConfiguracao {
  caminho: string;
  titulo: string;
  icone: string;
  /** Permissão para ver a aba (a rota filha também exige). */
  permissao: Permissao;
}

/** Abas de Configurações da empresa (E17). As telas de cada story se plugam como filhas lazy em `configuracoes.routes.ts`. */
export const ABAS_CONFIGURACOES: AbaConfiguracao[] = [
  { caminho: 'perfil', titulo: 'Perfil', icone: 'bi-building', permissao: 'core.empresa-perfil.ver' },
  { caminho: 'equipe', titulo: 'Equipe', icone: 'bi-people', permissao: 'core.equipe.ver' },
  { caminho: 'perfis', titulo: 'Perfis', icone: 'bi-shield-check', permissao: 'core.acesso.ver' },
  { caminho: 'fiscal', titulo: 'Fiscal', icone: 'bi-receipt', permissao: 'core.empresa-perfil.ver' },
  { caminho: 'integracoes', titulo: 'Integrações', icone: 'bi-plug', permissao: 'core.empresa-integracoes.ver' },
  { caminho: 'email', titulo: 'E-mail', icone: 'bi-envelope', permissao: 'core.empresa-email.ver' },
  { caminho: 'notificacoes', titulo: 'Notificações', icone: 'bi-bell', permissao: 'core.empresa-notificacoes.ver' },
  { caminho: 'historico', titulo: 'Histórico', icone: 'bi-clock-history', permissao: 'core.empresa-configuracoes.ver' }
];

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
      <h5 class="fw-bold mb-0"><i class="bi bi-gear me-2"></i>Configurações</h5>
    </div>
    <nav class="mb-3" aria-label="Abas de Configurações">
      <ul class="nav nav-pills gap-1">
        @for (aba of abas(); track aba.caminho) {
          <li class="nav-item">
            <a class="nav-link py-1" [routerLink]="['/configuracoes', aba.caminho]" routerLinkActive="active">
              <i class="bi {{ aba.icone }} me-1"></i>{{ aba.titulo }}
            </a>
          </li>
        }
      </ul>
    </nav>
    <router-outlet />
  `
})
export class ConfiguracoesComponent {
  private permissao = inject(PermissaoService);
  /** Só as abas que o perfil do usuário pode ver. */
  abas = computed(() => ABAS_CONFIGURACOES.filter(a => this.permissao.pode(a.permissao)));
}
