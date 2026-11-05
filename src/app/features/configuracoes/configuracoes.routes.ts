import { permissaoGuard } from '../../core/guards/permissao.guard';
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { PermissaoService } from '../../core/services/permissao.service';
import { ABAS_CONFIGURACOES, ConfiguracoesComponent } from './configuracoes.component';

const emConstrucao = () =>
  import('./configuracoes-em-construcao.component').then(m => m.ConfiguracoesEmConstrucaoComponent);

/** Telas reais por aba; aba sem tela cai no placeholder. */
const TELAS: Record<string, () => Promise<unknown>> = {
  perfil: () => import('./perfil/perfil.component').then(m => m.PerfilComponent),
  perfis: () => import('./perfis/perfis.component').then(m => m.PerfisComponent),
  equipe: () => import('./equipe/equipe.component').then(m => m.EquipeComponent),
  fiscal: () => import('./fiscal/fiscal.component').then(m => m.FiscalComponent),
  integracoes: () => import('./integracoes/integracoes.component').then(m => m.IntegracoesComponent),
  email: () => import('./email/email.component').then(m => m.EmailComponent),
  notificacoes: () => import('./notificacoes/notificacoes.component').then(m => m.NotificacoesComponent),
  historico: () => import('./historico/historico.component').then(m => m.HistoricoComponent)
};

/** `/configuracoes` abre a primeira aba que o perfil pode ver. */
const primeiraAba: CanActivateFn = () => {
  const permissao = inject(PermissaoService);
  const aba = ABAS_CONFIGURACOES.find(a => permissao.pode(a.permissao)) ?? ABAS_CONFIGURACOES[0];
  return inject(Router).createUrlTree(['/configuracoes', aba.caminho]);
};

export const CONFIGURACOES_ROUTES: Routes = [
  {
    path: '',
    component: ConfiguracoesComponent,
    children: [
      { path: '', pathMatch: 'full', canActivate: [primeiraAba], children: [] },
      ...ABAS_CONFIGURACOES.map(aba => ({
        path: aba.caminho,
        canActivate: [permissaoGuard],
        data: { titulo: aba.titulo, permissao: aba.permissao },
        loadComponent: (TELAS[aba.caminho] ?? emConstrucao) as () => Promise<never>
      }))
    ]
  }
];
