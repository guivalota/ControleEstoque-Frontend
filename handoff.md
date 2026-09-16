# Handoff — Controle de Estoque (Frontend Angular)

**Data:** 2026-06-06  
**Branch ativa:** `develop`  
**Backend:** `https://sleeve-equation-duly.ngrok-free.dev` (v1.9.8) — Docker Compose local + túnel ngrok (free); URL muda a cada restart do túnel, atualizar `environment.prod.ts` e a CSP `connect-src` em `src/index.html` quando isso acontecer.  
**Deploy:** GitHub Pages via GitHub Actions (merge em `master` → deploy automático)

---

## Stack

| Tecnologia | Versão |
|---|---|
| Angular | 19 (standalone components, signals, `@if`/`@for`) |
| Bootstrap | 5.3 |
| RxJS | 7.8 |
| TypeScript | 5.7 |

---

## Como rodar

```bash
npm start          # dev server → http://localhost:4200
npm run build      # build de produção → dist/controle-estoque/
npx tsc --noEmit   # typecheck
```

**Proxy:** `proxy.conf.json` redireciona `/api/*` → `http://localhost:5062` (dev).  
**Credenciais de teste:** `admin@example.com` / `Admin@123456`

---

## Arquitetura

```
src/app/
  core/
    guards/          auth.guard.ts · admin.guard.ts
    interceptors/    auth.interceptor.ts · token-refresh.interceptor.ts
    models/          uma interface por domínio
    services/        um serviço por domínio (signals + HttpClient)
  layout/
    shell/           root layout: sidebar + topbar + <router-outlet>
    sidebar/         nav links, versão do sistema no rodapé
    topbar/          usuário logado, role badge, edição de perfil
  features/          um componente por tela (lazy-loaded)
```

### Padrões de estado

- Serviços expõem `signal<T[]>` populados via `getAll()` → usado por selects em outros componentes
- Listagens com paginação gerenciam estado local (`resultados`, `total`, `page` como signals locais)
- Mutações (create/update) fazem refresh explícito após sucesso
- Delete usa optimistic update via `signal.update()` ou refresh pós-confirmação

### Auth

JWT em `localStorage` (`ce_token` / `ce_refresh`). `AuthService.decodeToken()` parseia com `atob()`.  
Claims: `sub` = UUID do usuário, `role` = `admin | operador | leitura`.  
`authGuard` → verifica `exp * 1000 > Date.now()`. `adminGuard` → verifica `role === 'admin'`.

### Bootstrap Modals

`import { Modal } from 'bootstrap'` + `@ViewChild` + lazy init no primeiro `open()`.  
Sempre `modal.dispose()` no `ngOnDestroy`.

---

## Rotas

| Path | Componente | Guard |
|---|---|---|
| `/login` | LoginComponent | — |
| `/esqueci-senha` | ForgotPasswordComponent | — |
| `/redefinir-senha` | ResetPasswordComponent | — |
| `/dashboard` | DashboardComponent | authGuard |
| `/produtos` | ProdutosComponent | authGuard |
| `/categorias` | CategoriasComponent | authGuard |
| `/movimentacoes` | MovimentacoesComponent | authGuard |
| `/usuarios` | UsersComponent | adminGuard |
| `/fornecedores` | FornecedoresComponent | authGuard |
| `/clientes` | ClientesComponent | authGuard |
| `/notas-fiscais` | NotasFiscaisComponent | authGuard |
| `/conferencia` | ConferenciaComponent | authGuard |
| `/pedidos-compra` | PedidosCompraComponent | authGuard |
| `/pedidos-compra/:id` | PedidoDetalheComponent | authGuard |
| `/admin/audit-logs` | AuditLogsComponent | adminGuard |
| `/admin/impressoes` | ImpressoesComponent | adminGuard |
| `/**` | NotFoundComponent | — |

---

## Funcionalidades implementadas

### Autenticação
- Login / logout com JWT (access + refresh token)
- Refresh automático via `token-refresh.interceptor`
- Fluxo esqueci senha / redefinir senha
- Edição de perfil próprio (qualquer role)

### Produtos
- CRUD completo com modal Bootstrap
- Campo `fazParteEstoque` (boolean, default `true`) — exclui produto de relatórios de estoque quando desmarcado
- Filtro por nome/SKU (client-side)

### Categorias, Usuários
- CRUD completo com modal
- Usuários: `role` = `admin | operador | leitura`; IDs são UUID (string)

### Fornecedores / Clientes
- CRUD com modal, busca de CNPJ (BrasilAPI), preenchimento de endereço por CEP
- **Filtros server-side:** busca por nome/documento, UF, status ativo
- **Paginação** server-side (50/página)
- **Botão imprimir lista** (PDF via `GET /v1/impressoes/fornecedores|clientes`)

### Movimentações
- CRUD paginado (50/página) com filtros: data, categoria, produto
- Tipos: `entrada | saida | ajuste | ajuste_saida`; `motivoAjuste` para ajustes
- **Vincular a pedido de compra:** ao criar uma entrada, se houver pedidos abertos com o produto selecionado, exibe select de item do pedido (`pedidoCompraItemId`)
- **Botão imprimir relatório** com filtros atuais

### Notas Fiscais
- Listagem paginada com **filtros server-side:** data início/fim, fornecedor, tipo, status
- Importação NF-e XML em **dois passos:**
  1. `POST /v1/nfe/analisar` → retorna itens com sugestão de produto por SKU
  2. Modal de resolução: por item, usuário escolhe **Mapear** (produto existente) ou **Criar** (campos pré-preenchidos, categoria obrigatória)
  3. `POST /v1/nfe/importar` com `resolucoes` JSON no multipart
  - Itens com ação "mapear" podem ser vinculados a itens de pedidos de compra abertos
- Cadastro manual de NF (fallback)
- **Botão imprimir lista** + **botão imprimir NF individual** por linha

### Dashboard *(atualizado para v1.8.0)*
- Consome `GET /v1/dashboard` em vez de derivar KPIs de múltiplos serviços
- 5 KPI cards: Produtos Ativos, Valor em Estoque, Abaixo do Mínimo, Reposição Pendente, Movimentações Hoje
- Card "Abaixo do Mínimo" (amarelo, clicável) → navega para `/conferencia?abaixoDoMinimo=true`
- Card "Reposição Pendente" (vermelho, clicável) → navega para `/conferencia/sugestoes`
- Botão "Atualizar" com spinner durante carregamento
- Polling automático a cada 60s (backend tem cache de 60s)
- Skeleton placeholders (Bootstrap `placeholder-glow`) durante a carga inicial
- Tabela "Últimas Movimentações" mantida (usa `MovimentacaoService` + `ProdutoService`)

### Conferência de Estoque
- Modo **produto individual:** filtro por data início/fim, incluir consumo interno
- Modo **visão geral:** paginação (50/página), filtros: data fim, categoria, apenas com saldo, abaixo do mínimo, incluir consumo interno
- **Botão imprimir posição de estoque** (modo geral, filtros atuais)

### Pedidos de Compra *(feature mais recente)*
- **Listagem:** filtros por status / criado por / destinado a; badge de status (aberto=azul, atendido=verde, cancelado=cinza)
- **Criação:** modal com FormArray de itens, destinatário opcional
- **Detalhe `/pedidos-compra/:id`:**
  - Tabela de itens com barra de progresso (`percentualAtendido`)
  - Ações: editar cabeçalho, adicionar item, remover item (se não atendido), cancelar pedido
  - **Botão imprimir PDF** (abre em nova aba)
- Status calculado automaticamente pelo backend após entradas vinculadas

### Audit Logs (`/admin/audit-logs`)
- Tabela paginada de todas as chamadas autenticadas ao backend
- Filtros: usuário, método HTTP, endpoint (busca parcial), período
- Badges coloridos por método (GET=azul, POST=verde, PUT=laranja, DELETE=vermelho)

### Histórico de Impressões (`/admin/impressoes`)
- Tabela paginada de todos os PDFs gerados
- Filtros: tipo de documento, usuário, período
- Botão **reimprimir** individual por linha
- Link para o documento impresso

### Layout
- Sidebar responsiva com offcanvas em mobile
- Versão do sistema exibida no rodapé da sidebar (via `GET /v1/version`)
- Tema claro/escuro (toggle na topbar)
- Página 404 para rotas inexistentes

---

## Serviços

| Serviço | Signal exposto | Observações |
|---|---|---|
| `AuthService` | `currentUser`, `isAuthenticated` | Decode JWT com `atob()` |
| `ProdutoService` | `produtos` | Carregado com `pageSize=1000` |
| `CategoriaService` | `categorias` | Carregado com `pageSize=1000` |
| `UserService` | `users` | IDs são UUID (string) |
| `FornecedorService` | `fornecedores` | `getAll()` para selects; `buscar(filtros)` para listagem |
| `ClienteService` | `clientes` | `getAll()` para selects; `buscar(filtros)` para listagem |
| `NotaFiscalService` | `notasFiscais` | `getAll()` para selects; `buscar(filtros)` para listagem |
| `MovimentacaoService` | `movimentacoes` | Paginável; retorna `{items, total}` |
| `DashboardService` | — | `get()` → `GET /v1/dashboard` |
| `ConferenciaService` | — | Stateless; retorna direto ao componente |
| `PedidoCompraService` | — | Stateless; `getAbertos()` usado em movimentações/NF-e |
| `AuditLogService` | — | Stateless |
| `ImpressaoService` | — | `gerarPdf(path, params)` genérico + `abrirPdf(blob)` |
| `NfeService` | — | `analisar(file)` + `importar(file, resolucoes)` |
| `VersionService` | `versao` | Carregado no `ngOnInit` da sidebar |
| `ThemeService` | — | Persiste em `localStorage` |
| `PermissaoService` | — | `canCreate/canEdit/canDelete/canManageUsers()` por role |

---

## Parâmetros de query — casing

| Endpoint | Parâmetros |
|---|---|
| `/v1/categorias`, `/v1/produtos`, `/v1/clientes`, `/v1/fornecedores`, `/v1/notas-fiscais`, `/v1/users` | camelCase (`page`, `pageSize`, `busca`, `fornecedorId`) |
| `/v1/movimentacoes` | PascalCase (`DataInicio`, `DataFim`, `CategoriaId`, `ProdutoId`, `Page`, `PageSize`) |
| `/v1/conferencia` | PascalCase (`DataFim`, `CategoriaId`, `ApenasComSaldo`, `AbaixoDoMinimo`, `IncluirConsumoInterno`, `Page`, `PageSize`) |
| `/v1/conferencia/{produtoId}` | PascalCase (`DataInicio`, `DataFim`, `IncluirConsumoInterno`) |

---

## Spec v1.8.0 — status de implementação

Spec: `C:\Users\Guilherme\Documents\claude\dotnet\ControleEstoque\frontend-spec-v1.8.md`

| Feature | Status | Observações |
|---|---|---|
| **Dashboard** `GET /v1/dashboard` | ✅ Feito | KPIs, polling 60s, cards clicáveis |
| **Alertas** `POST /v1/alertas/estoque-baixo` | ⬜ Pendente | Botão na tela de Conferência; toast de confirmação |
| **Sugestões de Reposição** `GET /v1/conferencia/sugestoes-reposicao` | ⬜ Pendente | Nova rota `/conferencia/sugestoes`; componente `SugestoesReposicaoComponent` |
| **`pontoReposicao`** em `GET /v1/conferencia` | ⬜ Pendente | Adicionar campo em `ConferenciaResult`; nova coluna na tabela; filtro `abaixoDoPontoReposicao` |
| **Histórico de preço** `GET /v1/movimentacoes/historico-preco/{id}` | ⬜ Pendente | Aba no detalhe do produto; gráfico Chart.js |
| **Export CSV** `?formato=csv` | ⬜ Pendente | Botões "⬇ Exportar CSV" em Movimentações e Conferência |

### Próximos passos sugeridos (ordem)

1. `pontoReposicao` em `ConferenciaResult` + coluna + filtro `abaixoDoPontoReposicao` (pequena mudança, base para o resto)
2. `SugestoesReposicaoComponent` em `/conferencia/sugestoes` (card do dashboard já navega para cá)
3. Alertas de estoque baixo (botão na tela de conferência)
4. Export CSV (movimentações e conferência)
5. Histórico de preço médio (gráfico — requer instalação de Chart.js ou ngx-charts)

---

## O que ainda não foi feito / possíveis próximos passos (outros)

- Testes unitários e de integração no frontend (Karma/Jasmine configurados mas sem specs de feature)
- Notificações toast (erros de impressão usam `alert()` temporariamente)
- Busca/autocomplete com debounce para selects de produto nos filtros de movimentações
- Paginação na tela de Produtos (atualmente carrega tudo via `pageSize=1000`)
- Paginação na tela de Categorias (idem)
