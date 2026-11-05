import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { contaEmpresaGuard, superAdminGuard } from './core/guards/conta.guard';
import { permissaoGuard } from './core/guards/permissao.guard';
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
        path: 'financeiro',
        canActivate: [moduloGuard('financeiro'), permissaoGuard],
        data: { permissao: 'financeiro.status.ver' },
        loadComponent: () => import('./features/financeiro/financeiro-inicio.component').then(m => m.FinanceiroInicioComponent)
      },
      {
        path: 'financeiro/cadastros',
        canActivate: [moduloGuard('financeiro'), permissaoGuard],
        data: { permissao: 'financeiro.cadastros.ver' },
        loadComponent: () => import('./features/financeiro/cadastros/cadastros-financeiro.component').then(m => m.CadastrosFinanceiroComponent)
      },
      {
        path: 'producao',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.dashboard.ver' },
        loadComponent: () => import('./features/producao/producao-inicio.component').then(m => m.ProducaoInicioComponent)
      },
      {
        path: 'producao/fichas-tecnicas',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.fichas-tecnicas.ver' },
        loadComponent: () => import('./features/producao/fichas-tecnicas/fichas-tecnicas-lista.component').then(m => m.FichasTecnicasListaComponent)
      },
      {
        path: 'producao/relatorios',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.relatorios.ver' },
        loadComponent: () => import('./features/producao/relatorios/relatorios-producao.component').then(m => m.RelatoriosProducaoComponent)
      },
      {
        path: 'producao/rastreio/lote/:id',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.rastreio.ver' },
        loadComponent: () => import('./features/producao/rastreio/rastreio-lote.component').then(m => m.RastreioLoteComponent)
      },
      {
        path: 'producao/faccao',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.faccao-remessas.ver' },
        loadComponent: () => import('./features/producao/faccao/remessas-lista.component').then(m => m.RemessasListaComponent)
      },
      {
        path: 'producao/faccao/nova',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.faccao-remessas.criar' },
        loadComponent: () => import('./features/producao/faccao/remessa-form.component').then(m => m.RemessaFormComponent)
      },
      {
        path: 'producao/faccao/:id',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.faccao-remessas.ver' },
        loadComponent: () => import('./features/producao/faccao/remessa-detalhe.component').then(m => m.RemessaDetalheComponent)
      },
      {
        path: 'producao/necessidade-materiais',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.necessidade-materiais.ver' },
        loadComponent: () => import('./features/producao/necessidade/necessidade-materiais.component').then(m => m.NecessidadeMateriaisComponent)
      },
      {
        path: 'producao/ordens',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.ordens.ver' },
        loadComponent: () => import('./features/producao/ordens/ordens-lista.component').then(m => m.OrdensListaComponent)
      },
      {
        path: 'producao/ordens/nova',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.ordens.criar' },
        loadComponent: () => import('./features/producao/ordens/ordem-form.component').then(m => m.OrdemFormComponent)
      },
      {
        path: 'producao/ordens/:id',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.ordens.ver' },
        loadComponent: () => import('./features/producao/ordens/ordem-detalhe.component').then(m => m.OrdemDetalheComponent)
      },
      {
        path: 'producao/fichas-tecnicas/produto/:produtoId',
        canActivate: [moduloGuard('producao'), permissaoGuard],
        data: { permissao: 'producao.fichas-tecnicas.ver' },
        loadComponent: () => import('./features/producao/fichas-tecnicas/ficha-tecnica-editor.component').then(m => m.FichaTecnicaEditorComponent)
      },
      {
        path: 'dashboard',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.dashboard.ver' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'produtos',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.produtos.ver' },
        loadComponent: () => import('./features/produtos/produtos.component').then(m => m.ProdutosComponent)
      },
      {
        path: 'produtos/:id/grade',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.grade.ver' },
        loadComponent: () => import('./features/produtos/grade/produto-grade.component').then(m => m.ProdutoGradeComponent)
      },
      {
        path: 'categorias',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.categorias.ver' },
        loadComponent: () => import('./features/categorias/categorias.component').then(m => m.CategoriasComponent)
      },
      {
        path: 'grade',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.grade.ver' },
        loadComponent: () => import('./features/grade/grade-cadastro.component').then(m => m.GradeCadastroComponent)
      },
      {
        path: 'movimentacoes',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.movimentacoes.ver' },
        loadComponent: () => import('./features/movimentacoes/movimentacoes.component').then(m => m.MovimentacoesComponent)
      },
      {
        path: 'lotes',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.lotes.ver' },
        loadComponent: () => import('./features/lotes/lotes.component').then(m => m.LotesComponent)
      },
      {
        // Antiga tela "Usuários" (chamava v1/users, só do super admin): a equipe da empresa agora é Configurações → Equipe.
        path: 'usuarios',
        pathMatch: 'full',
        redirectTo: 'configuracoes/equipe'
      },
      {
        path: 'fornecedores',
        canActivate: [permissaoGuard],
        data: { permissao: 'core.fornecedores.ver' },
        loadComponent: () => import('./features/fornecedores/fornecedores.component').then(m => m.FornecedoresComponent)
      },
      {
        path: 'clientes',
        canActivate: [permissaoGuard],
        data: { permissao: 'core.clientes.ver' },
        loadComponent: () => import('./features/clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'notas-fiscais',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.notas-fiscais.ver' },
        loadComponent: () => import('./features/notas-fiscais/notas-fiscais.component').then(m => m.NotasFiscaisComponent)
      },
      {
        path: 'conferencia',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.conferencia.ver' },
        loadComponent: () => import('./features/conferencia/conferencia.component').then(m => m.ConferenciaComponent)
      },
      {
        path: 'conferencia/sugestoes',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.conferencia.ver' },
        loadComponent: () => import('./features/conferencia/sugestoes-reposicao/sugestoes-reposicao.component').then(m => m.SugestoesReposicaoComponent)
      },
      {
        path: 'conferencia/giro-estoque',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.conferencia.ver' },
        loadComponent: () => import('./features/conferencia/giro-estoque/giro-estoque.component').then(m => m.GiroEstoqueComponent)
      },
      {
        path: 'conferencia/curva-abc',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.conferencia.ver' },
        loadComponent: () => import('./features/conferencia/curva-abc/curva-abc.component').then(m => m.CurvaAbcComponent)
      },
      {
        path: 'pedidos-compra',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.pedidos-compra.ver' },
        loadComponent: () => import('./features/pedidos-compra/pedidos-compra.component').then(m => m.PedidosCompraComponent)
      },
      {
        path: 'pedidos-compra/:id',
        canActivate: [moduloGuard('estoque'), permissaoGuard],
        data: { permissao: 'estoque.pedidos-compra.ver' },
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
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.bens.ver' },
            loadComponent: () => import('./features/imobilizado/bens/imob-bens.component').then(m => m.ImobBensComponent)
          },
          {
            path: 'bens/importar',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.bens.importacao-validar' },
            loadComponent: () => import('./features/imobilizado/bens/imob-importacao-bens.component').then(m => m.ImobImportacaoBensComponent)
          },
          {
            path: 'bens/renovar-etiquetas',
            canActivate: [permissaoGuard],
            data: { permissao: ['imobilizado.bens.de-para', 'imobilizado.bens.codigo-anterior'] },
            loadComponent: () => import('./features/imobilizado/bens/imob-renovacao-etiquetas.component').then(m => m.ImobRenovacaoEtiquetasComponent)
          },
          {
            path: 'bens/novo',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.bens.criar' },
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-form.component').then(m => m.ImobBemFormComponent)
          },
          {
            path: 'bens/:id/editar',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.bens.editar' },
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-form.component').then(m => m.ImobBemFormComponent)
          },
          {
            path: 'bens/:id',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.bens.ver' },
            loadComponent: () => import('./features/imobilizado/bens/imob-bem-detalhe.component').then(m => m.ImobBemDetalheComponent)
          },
          {
            path: 'inventarios',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.inventarios.ver' },
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventarios.component').then(m => m.ImobInventariosComponent)
          },
          {
            path: 'inventarios/novo',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.inventarios.criar' },
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-form.component').then(m => m.ImobInventarioFormComponent)
          },
          {
            path: 'inventarios/:id/editar',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.inventarios.editar' },
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-form.component').then(m => m.ImobInventarioFormComponent)
          },
          {
            path: 'inventarios/:id',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.inventarios.ver' },
            loadComponent: () => import('./features/imobilizado/inventarios/imob-inventario-detalhe.component').then(m => m.ImobInventarioDetalheComponent)
          },
          {
            path: 'ordens-servico',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.ordens-servico.ver' },
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-ordens-servico.component').then(m => m.ImobOrdensServicoComponent)
          },
          {
            path: 'ordens-servico/nova',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.ordens-servico.criar' },
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-os-form.component').then(m => m.ImobOsFormComponent)
          },
          {
            path: 'ordens-servico/:id',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.ordens-servico.ver' },
            loadComponent: () => import('./features/imobilizado/ordens-servico/imob-os-detalhe.component').then(m => m.ImobOsDetalheComponent)
          },
          {
            path: 'depreciacao',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.depreciacao-periodos.ver' },
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-painel.component').then(m => m.ImobDepreciacaoPainelComponent)
          },
          {
            path: 'depreciacao/fechamento',
            canActivate: [permissaoGuard],
            data: { permissao: ['imobilizado.depreciacao-previa.ver', 'imobilizado.depreciacao-periodos.fechar'] },
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-fechamento.component').then(m => m.ImobDepreciacaoFechamentoComponent)
          },
          {
            path: 'depreciacao/periodos/:mes',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.depreciacao-periodos.ver' },
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-periodo.component').then(m => m.ImobDepreciacaoPeriodoComponent)
          },
          {
            path: 'depreciacao/relatorios',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.depreciacao-relatorios.ver' },
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-relatorios.component').then(m => m.ImobDepreciacaoRelatoriosComponent)
          },
          {
            path: 'depreciacao/ajuda',
            loadComponent: () => import('./features/imobilizado/depreciacao/imob-depreciacao-ajuda.component').then(m => m.ImobDepreciacaoAjudaComponent)
          },
          {
            path: 'locais',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.locais.ver' },
            loadComponent: () => import('./features/imobilizado/locais/imob-locais.component').then(m => m.ImobLocaisComponent)
          },
          {
            path: 'categorias',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.categorias.ver' },
            loadComponent: () => import('./features/imobilizado/categorias/imob-categorias.component').then(m => m.ImobCategoriasComponent)
          },
          {
            path: 'grupos',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.grupos.ver' },
            loadComponent: () => import('./features/imobilizado/grupos/imob-grupos.component').then(m => m.ImobGruposComponent)
          },
          {
            path: 'departamentos',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.departamentos.ver' },
            loadComponent: () => import('./features/imobilizado/departamentos/imob-departamentos.component').then(m => m.ImobDepartamentosComponent)
          },
          {
            path: 'reavaliacao/estados-conservacao',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.estados-conservacao.ver' },
            loadComponent: () => import('./features/imobilizado/estados-conservacao/imob-estados-conservacao.component').then(m => m.ImobEstadosConservacaoComponent)
          },
          {
            path: 'reavaliacao/pesos',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.reavaliacao-parametros.ver' },
            loadComponent: () => import('./features/imobilizado/parametros/imob-reavaliacao-pesos.component').then(m => m.ImobReavaliacaoPesosComponent)
          },
          {
            path: 'reavaliacao/escalas',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.reavaliacao-escalas.ver' },
            loadComponent: () => import('./features/imobilizado/parametros/imob-reavaliacao-escalas.component').then(m => m.ImobReavaliacaoEscalasComponent)
          },
          {
            path: 'responsaveis',
            canActivate: [permissaoGuard],
            data: { permissao: 'imobilizado.responsaveis.ver' },
            loadComponent: () => import('./features/imobilizado/responsaveis/imob-responsaveis.component').then(m => m.ImobResponsaveisComponent)
          }
        ]
      },
      {
        path: 'configuracoes',
        canActivate: [permissaoGuard],
        data: { permissao: ['core.empresa-perfil.ver', 'core.empresa-email.ver', 'core.empresa-integracoes.ver', 'core.empresa-notificacoes.ver', 'core.empresa-configuracoes.ver', 'core.equipe.ver', 'core.acesso.ver'] },
        loadChildren: () => import('./features/configuracoes/configuracoes.routes').then(m => m.CONFIGURACOES_ROUTES)
      },
      {
        path: 'manual',
        loadComponent: () => import('./features/manual/manual.component').then(m => m.ManualComponent)
      },
      {
        path: 'manual/:modulo',
        loadComponent: () => import('./features/manual/manual.component').then(m => m.ManualComponent)
      },
      {
        path: 'admin/impressoes',
        canActivate: [permissaoGuard],
        data: { permissao: 'estoque.impressoes.historico' },
        loadComponent: () => import('./features/impressoes/impressoes.component').then(m => m.ImpressoesComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
