import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

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
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
