import { Routes } from '@angular/router';
import { ABAS_CONFIGURACOES, ConfiguracoesComponent } from './configuracoes.component';

const emConstrucao = () =>
  import('./configuracoes-em-construcao.component').then(m => m.ConfiguracoesEmConstrucaoComponent);

/** Telas reais por aba; aba sem tela cai no placeholder. */
const TELAS: Record<string, () => Promise<unknown>> = {
  perfil: () => import('./perfil/perfil.component').then(m => m.PerfilComponent),
  fiscal: () => import('./fiscal/fiscal.component').then(m => m.FiscalComponent),
  integracoes: () => import('./integracoes/integracoes.component').then(m => m.IntegracoesComponent),
  email: () => import('./email/email.component').then(m => m.EmailComponent),
  notificacoes: () => import('./notificacoes/notificacoes.component').then(m => m.NotificacoesComponent),
  historico: () => import('./historico/historico.component').then(m => m.HistoricoComponent)
};

export const CONFIGURACOES_ROUTES: Routes = [
  {
    path: '',
    component: ConfiguracoesComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'perfil' },
      ...ABAS_CONFIGURACOES.map(aba => ({
        path: aba.caminho,
        data: { titulo: aba.titulo },
        loadComponent: (TELAS[aba.caminho] ?? emConstrucao) as () => Promise<never>
      }))
    ]
  }
];
