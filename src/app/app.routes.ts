import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { perfilAdminGuard } from './core/guards/perfil-admin.guard';
import { contaEmpresaGuard, superAdminGuard } from './core/guards/conta.guard';
import { escritaGuard } from './core/guards/escrita.guard';
import { cargaEmpresaGuard } from './core/guards/carga-empresa.guard';
import { moduloGuard } from './core/guards/modulo.guard';
import { empresaAtivaGuard, imobilizadoGuard } from './core/guards/empresa-ativa.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'esqueci-senha',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'redefinir-senha',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'definir-senha',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/definir-senha/definir-senha.component').then(m => m.DefinirSenhaComponent)
  },
  {
    path: 'plataforma',
    canActivate: [authGuard, superAdminGuard],
    loadComponent: () => import('./features/plataforma/plataforma.component').then(m => m.PlataformaComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'empresas' },
      {
        path: 'empresas',
        loadComponent: () => import('./features/plataforma/empresas/plataforma-empresas.component').then(m => m.PlataformaEmpresasComponent)
      },
      {
        path: 'empresas/:id',
        loadComponent: () => import('./features/plataforma/empresas/plataforma-empresa-detalhe.component').then(m => m.PlataformaEmpresaDetalheComponent)
      },
      {
        path: 'planos',
        loadComponent: () => import('./features/plataforma/planos/plataforma-planos.component').then(m => m.PlataformaPlanosComponent)
      },
      {
        path: 'super-admins',
        loadComponent: () => import('./features/plataforma/super-admins/super-admins.component').then(m => m.PlataformaSuperAdminsComponent)
      },
      {
        path: 'contas',
        loadComponent: () => import('./features/plataforma/contas/contas.component').then(m => m.PlataformaContasComponent)
      },
      {
        path: 'logs',
        loadComponent: () => import('./features/plataforma/logs/logs.component').then(m => m.PlataformaLogsComponent)
      }
    ]
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard, contaEmpresaGuard, cargaEmpresaGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'produtos',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/produtos/produtos.component').then(m => m.ProdutosComponent)
      },
      {
        path: 'categorias',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'movimentacoes',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/movimentacoes/movimentacoes.component').then(m => m.MovimentacoesComponent)
      },
      {
        path: 'lotes',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/lotes/lotes.component').then(m => m.LotesComponent)
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'fornecedores',
        loadComponent: () => import('./features/fornecedores/fornecedores.component').then(m => m.FornecedoresComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'notas-fiscais',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/notas-fiscais/notas-fiscais.component').then(m => m.NotasFiscaisComponent)
      },
      {
        path: 'conferencia',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/conferencia/conferencia.component').then(m => m.ConferenciaComponent)
      },
      {
        path: 'conferencia/sugestoes',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/conferencia/sugestoes-reposicao/sugestoes-reposicao.component').then(m => m.SugestoesReposicaoComponent)
      },
      {
        path: 'conferencia/giro-estoque',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/conferencia/giro-estoque/giro-estoque.component').then(m => m.GiroEstoqueComponent)
      },
      {
        path: 'conferencia/curva-abc',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/conferencia/curva-abc/curva-abc.component').then(m => m.CurvaAbcComponent)
      },
      {
        path: 'pedidos-compra',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/pedidos-compra/pedidos-compra.component').then(m => m.PedidosCompraComponent)
      },
      {
        path: 'pedidos-compra/:id',
        canActivate: [moduloGuard('estoque')],
        loadComponent: () => import('./features/pedidos-compra/detalhe/pedido-detalhe.component').then(m => m.PedidoDetalheComponent)
      },
      {
        path: 'imobilizado',
        canActivate: [moduloGuard('imobilizado'), imobilizadoGuard],
        canActivateChild: [empresaAtivaGuard],
        loadComponent: () => import('./features/imobilizado/shell/imobilizado-shell.component').then(m => m.ImobilizadoShellComponent),
        children: [
          {
            path: '',
            data: { dispensaEmpresa: true },
            loadComponent: () => import('./features/imobilizado/inicio/imobilizado-inicio.component').then(m => m.ImobilizadoInicioComponent)
          },
          {
            path: 'bens',
            loadComponent: () => import('./features/imobilizado/bens/imob-bens.component').then(m => m.ImobBensComponent)
          },
          {
            path: 'bens/importar',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/bens/imob-importacao-bens.component').then(m => m.ImobImportacaoBensComponent)
          },
          {
            path: 'bens/novo',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-form.component').then(m => m.ImobBemFormComponent)
          },
          {
            path: 'bens/:id/editar',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-form.component').then(m => m.ImobBemFormComponent)
          },
          {
            path: 'bens/:id',
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-detalhe.component').then(m => m.ImobBemDetalheComponent)
          },
          {
            path: 'inventarios',
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventarios.component').then(m => m.ImobInventariosComponent)
          },
          {
            path: 'inventarios/novo',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-form.component').then(m => m.ImobInventarioFormComponent)
          },
          {
            path: 'inventarios/:id/editar',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-form.component').then(m => m.ImobInventarioFormComponent)
          },
          {
            path: 'inventarios/:id',
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-detalhe.component').then(m => m.ImobInventarioDetalheComponent)
          },
          {
            path: 'ordens-servico',
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-ordens-servico.component').then(m => m.ImobOrdensServicoComponent)
          },
          {
            path: 'ordens-servico/nova',
            canActivate: [escritaGuard],
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-os-form.component').then(m => m.ImobOsFormComponent)
          },
          {
            path: 'ordens-servico/:id',
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-os-detalhe.component').then(m => m.ImobOsDetalheComponent)
          },
          {
            path: 'depreciacao',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-painel.component').then(m => m.ImobDepreciacaoPainelComponent)
          },
          {
            path: 'depreciacao/fechamento',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-fechamento.component').then(m => m.ImobDepreciacaoFechamentoComponent)
          },
          {
            path: 'depreciacao/periodos/:mes',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-periodo.component').then(m => m.ImobDepreciacaoPeriodoComponent)
          },
          {
            path: 'depreciacao/relatorios',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-relatorios.component').then(m => m.ImobDepreciacaoRelatoriosComponent)
          },
          {
            path: 'depreciacao/ajuda',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-ajuda.component').then(m => m.ImobDepreciacaoAjudaComponent)
          },
          {
            path: 'locais',
            loadComponent: () => import('./features/imobilizado/locais/imob-locais.component').then(m => m.ImobLocaisComponent)
          },
          {
            path: 'categorias',
            loadComponent: () => import('./features/imobilizado/categorias/imob-categorias.component').then(m => m.ImobCategoriasComponent)
          },
          {
            path: 'grupos',
            loadComponent: () => import('./features/imobilizado/grupos/imob-grupos.component').then(m => m.ImobGruposComponent)
          },
          {
            path: 'departamentos',
            loadComponent: () => import('./features/imobilizado/departamentos/imob-departamentos.component').then(m => m.ImobDepartamentosComponent)
          },
          {
            path: 'reavaliacao/estados-conservacao',
            loadComponent: () => import('./features/imobilizado/estados-conservacao/imob-estados-conservacao.component').then(m => m.ImobEstadosConservacaoComponent)
          },
          {
            path: 'reavaliacao/pesos',
            loadComponent: () => import('./features/imobilizado/parametros/imob-reavaliacao-pesos.component').then(m => m.ImobReavaliacaoPesosComponent)
          },
          {
            path: 'reavaliacao/escalas',
            loadComponent: () => import('./features/imobilizado/parametros/imob-reavaliacao-escalas.component').then(m => m.ImobReavaliacaoEscalasComponent)
          },
          {
            path: 'responsaveis',
            loadComponent: () => import('./features/imobilizado/responsaveis/imob-responsaveis.component').then(m => m.ImobResponsaveisComponent)
          }
        ]
      },
      {
        path: 'configuracoes',
        canActivate: [perfilAdminGuard],
        loadChildren: () => import('./features/configuracoes/configuracoes.routes').then(m => m.CONFIGURACOES_ROUTES)
      },
      {
        path: 'manual',
        loadComponent: () => import('./features/manual/manual.component').then(m => m.ManualComponent)
      },
      {
        path: 'admin/impressoes',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/impressoes/impressoes.component').then(m => m.ImpressoesComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
