import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { escritaGuard } from './core/guards/escrita.guard';
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
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'produtos',
        loadComponent: () => import('./features/produtos/produtos.component').then(m => m.ProdutosComponent)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./features/categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'movimentacoes',
        loadComponent: () => import('./features/movimentacoes/movimentacoes.component').then(m => m.MovimentacoesComponent)
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
        loadComponent: () => import('./features/notas-fiscais/notas-fiscais.component').then(m => m.NotasFiscaisComponent)
      },
      {
        path: 'conferencia',
        loadComponent: () => import('./features/conferencia/conferencia.component').then(m => m.ConferenciaComponent)
      },
      {
        path: 'conferencia/sugestoes',
        loadComponent: () => import('./features/conferencia/sugestoes-reposicao/sugestoes-reposicao.component').then(m => m.SugestoesReposicaoComponent)
      },
      {
        path: 'conferencia/giro-estoque',
        loadComponent: () => import('./features/conferencia/giro-estoque/giro-estoque.component').then(m => m.GiroEstoqueComponent)
      },
      {
        path: 'conferencia/curva-abc',
        loadComponent: () => import('./features/conferencia/curva-abc/curva-abc.component').then(m => m.CurvaAbcComponent)
      },
      {
        path: 'pedidos-compra',
        loadComponent: () => import('./features/pedidos-compra/pedidos-compra.component').then(m => m.PedidosCompraComponent)
      },
      {
        path: 'pedidos-compra/:id',
        loadComponent: () => import('./features/pedidos-compra/detalhe/pedido-detalhe.component').then(m => m.PedidoDetalheComponent)
      },
      {
        path: 'admin/audit-logs',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent)
      },
      {
        path: 'imobilizado',
        canActivate: [imobilizadoGuard],
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
            path: 'locais',
            loadComponent: () => import('./features/imobilizado/locais/imob-locais.component').then(m => m.ImobLocaisComponent)
          },
          {
            path: 'categorias',
            loadComponent: () => import('./features/imobilizado/categorias/imob-categorias.component').then(m => m.ImobCategoriasComponent)
          },
          {
            path: 'responsaveis',
            loadComponent: () => import('./features/imobilizado/responsaveis/imob-responsaveis.component').then(m => m.ImobResponsaveisComponent)
          },
          {
            path: 'empresas',
            canActivate: [adminGuard],
            data: { dispensaEmpresa: true, administracao: true },
            loadComponent: () => import('./features/imobilizado/empresas/imob-empresas.component').then(m => m.ImobEmpresasComponent)
          },
          {
            path: 'empresas/:id/usuarios',
            canActivate: [adminGuard],
            data: { dispensaEmpresa: true, administracao: true },
            loadComponent: () => import('./features/imobilizado/empresas/imob-empresa-usuarios.component').then(m => m.ImobEmpresaUsuariosComponent)
          }
        ]
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
