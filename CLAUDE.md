# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branches

| Branch | Função |
|---|---|
| `master` | **Produção** — protegida; merge só via PR com 1 aprovação |
| `develop` | Desenvolvimento — branch base para novas features/fixes |

**Fluxo:** trabalhe em `develop` (ou feature branches) → abra PR para `master` → aprovação → merge → deploy automático no GitHub Pages.

## Commands

```bash
npm start          # dev server → http://localhost:4200
npm run build      # production build → dist/controle-estoque/
npm test           # unit tests via Karma
ng lint            # ESLint (legacy Estoque code has ~140 pre-existing errors; lint only changed paths: npx eslint <paths>)
```

## Backend

API runs at `https://controle-estoque-dotnet-production.up.railway.app` (production).  
Dev proxy in `proxy.conf.json` forwards `/api/*` → Railway (strips `/api`, keeps `/v1/...`).  
`environment.ts` uses `apiUrl: '/api'` (dev via proxy) · `environment.prod.ts` uses the Railway base URL (no `/v1`).  
Each service appends `/v1/` explicitly: `${environment.apiUrl}/v1/categorias`, etc.

**Test credentials** — veja `.env.local` (não versionado). Endpoint: `POST /v1/auth/login` com body `{ "email": "...", "senha": "..." }`.  
Note: the login field is `senha`, not `password`. Response: `{ accessToken, refreshToken, expiresIn }`.

### API response format

**All list endpoints return a paginated object** — `{ items: T[], page, pageSize, total }`.  
Services type as `http.get<PagedResult<T>>(url)` and extract `.items` into the signal.

Simple list services (categorias, produtos, fornecedores, clientes, users, notas-fiscais) call with `pageSize=1000` to load all records into the signal at once.  
Paginable services (movimentacoes, conferencia) receive `Page`/`PageSize` from the component and return `{ items, total }` for the component to manage pagination state.

Do NOT use `ApiResult<T>` / `res.value` patterns — that interface was removed from `nota-fiscal.model.ts`.

### Query parameter casing per endpoint

Query param casing depends on the endpoint group:

| Endpoint | Params |
|---|---|
| `GET /v1/categorias`, `/v1/produtos`, etc. | `page`, `pageSize` (camelCase) |
| `GET /v1/movimentacoes` | `DataInicio`, `DataFim`, `CategoriaId`, `ProdutoId`, `Page`, `PageSize` (PascalCase) |
| `GET /v1/conferencia` | `DataFim`, `CategoriaId`, `ApenasComSaldo`, `AbaixoDoMinimo`, `Page`, `PageSize` (PascalCase) |
| `GET /v1/conferencia/{produtoId}` | `DataInicio`, `DataFim` (PascalCase) |

> Note: `GET /conferencia` does **not** accept `DataInicio` — only `DataFim` as upper bound.

---

## Architecture

**Angular 19 · Standalone components · Bootstrap 5 · Signals**

```
src/app/
  core/
    guards/auth.guard.ts              # functional guard — redirects to /login if not authenticated
    interceptors/auth.interceptor.ts  # adds Bearer token to every request
    models/                           # TypeScript interfaces
    services/                         # one service per domain; each holds a signal<T[]>
  layout/
    shell/                            # root layout: sidebar + topbar + <router-outlet>
    sidebar/                          # nav links with routerLinkActive
    topbar/                           # current user name/role + logout button
  features/
    auth/login/                       # login form → navigates to /dashboard on success
    dashboard/                        # KPI cards + last 10 movements (reads from multiple services)
    produtos/                         # CRUD with Bootstrap Modal; includes category select
    categorias/                       # CRUD with Bootstrap Modal
    movimentacoes/                    # CRUD (entrada/saida/ajuste/ajuste_saida) + filter by date/category/product/NF
    users/                            # CRUD with Bootstrap Modal; role: admin | operador | leitura
    fornecedores/                     # CRUD with Bootstrap Modal; consulta CNPJ
    clientes/                         # CRUD with Bootstrap Modal; CPF or CNPJ identifier
    notas-fiscais/                    # NF-e import and listing; links to movimentacoes
    conferencia/                      # stock audit: individual product (with date filter) + general overview (paginated)
    imobilizado/                      # fixed-assets module (multi-company) — see "Área Imobilizado" below
```

### Routing

`/login` is unguarded. All other routes are under `ShellComponent` protected by `authGuard`. Every feature is lazy-loaded via `loadComponent`.

### State management

Each service exposes a `signal<T[]>` (e.g., `produtos = signal<Produto[]>([])`). After every mutation (create/update), `getAll()` is called via `switchMap` to refresh the signal. Delete uses optimistic update via `signal.update()`. Components read signals directly in templates.

### Auth flow

`POST /v1/auth/login` → stores `accessToken` + `refreshToken` in `localStorage` under keys `ce_token` / `ce_refresh` → `AuthService.decodeToken()` parses JWT with `atob()` → exposes `currentUser` signal → `authInterceptor` injects `Authorization: Bearer {token}` → `authGuard` checks `isAuthenticated()` computed signal (verifies `exp * 1000 > Date.now()`).

JWT claims use full URI keys: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` → `nome`, `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` → `role`.

### Bootstrap Modals

Components import `Modal` from `'bootstrap'` (typed via `src/typings.d.ts`). Each component holds `private modal!: Modal` initialised lazily on first open via `@ViewChild('modalEl')`. Always call `modal.dispose()` in `ngOnDestroy`.

---

## Área Imobilizado (controle patrimonial)

Separate module from Estoque (own routes, services, models). Contract specs live in `docs/imobilizado/` (`frontend-spec-imob-*.md`; `PLANO_DE_ACAO.md` is backend context) — read them before changing endpoints, error messages or types, and report backend divergences instead of working around them.

```
core/models/imob-*.model.ts, paged-result.model.ts
core/services/empresa-ativa.service.ts    # active company state (signals) + localStorage `imob.empresaId`
core/services/imob-{empresa,local,categoria,responsavel,bem}.service.ts   # stateless: return Observables, no signals
core/interceptors/empresa.interceptor.ts  # X-Empresa-Id + 403 handling
core/guards/empresa-ativa.guard.ts        # imobilizadoGuard (loads companies) + empresaAtivaGuard (canActivateChild)
core/guards/escrita.guard.ts              # create/edit routes: admin/operador only
core/utils/                               # cnpj, erros-api, http-params, imob-formato (BRL/date/%/vida útil), historico-formato, local-arvore, validadores, download
features/imobilizado/
  shell/        # area header (active company + "Trocar"), tabs, mandatory company selector modal
  empresas/     # company admin + user links (admin only)
  locais/ categorias/ responsaveis/   # base registers
  bens/         # list, form, detail (+ Histórico tab), CSV export
  shared/       # confirm-dialog, paginacao, seletor-local (CVA), autocomplete-responsavel (CVA), bloqueio-exclusao
testing/auth-fake.ts   # provideAuthFake(role) for specs
```

Routes: `/imobilizado` (shell, `imobilizadoGuard`) → children `bens`, `bens/importar`, `bens/novo`, `bens/:id/editar`, `bens/:id` (abas Dados · Histórico · Depreciação), `inventarios*` (`/:id/contagem`, `/:id/conciliacao`), `ordens-servico` (`/nova`, `/:id`), `depreciacao` (`/fechamento`, `/periodos/:mes`, `/relatorios`, `/ajuda`), `locais`, `categorias`, `responsaveis`, `empresas`, `empresas/:id/usuarios`.

Estoque também tem `lotes` (CRUD + validade; params PascalCase) e `loteId` opcional na criação de movimentações.

### Multi-company (X-Empresa-Id)

- Every data call to `v1/imobilizado/**` carries `X-Empresa-Id` (set by `empresaInterceptor`). **No header** for `minhas-empresas` and `empresas/**` (admin). Never send `empresaId` in body or query.
- `EmpresaAtivaService.carregar()` reloads `minhas-empresas`: 0 companies → "sem acesso" screen, 1 → auto-select, 2+ → restore saved id if still listed, else mandatory selector. `imobilizadoGuard` calls it on every entry to the area.
- A `403` on a data call → `perdeuAcesso()`: clears selection, reloads the list, shows "Seu acesso a esta empresa foi alterado.".
- Switching company recreates the `<router-outlet>` (keyed by company id) and navigates to `/imobilizado`, discarding screen state.
- Routes marked `data: { dispensaEmpresa: true }` skip `empresaAtivaGuard`; `data: { administracao: true }` (company admin screens) also render without an active company and don't force the selector. Even admins must be linked to a company to see its data.

### Conventions specific to this area

- Roles via `PermissaoService`. No Imobilizado use `imobCanCreate`/`imobCanEdit`/`imobCanDelete` (perfil **efetivo** = menor entre a role global e `EmpresaAtiva.perfil`; o perfil só restringe). `canCreate`/`canEdit`/`canDelete` ficam para o Estoque. Hide write buttons **and** protect routes (`adminGuard`, `escritaGuard`); the backend is the real authority.
- 403 com `{ error }` (perfil, equipe do inventário, dono da OS) mantém a tela e mostra a mensagem; só `Sem acesso à empresa...` (ou 403 sem mensagem) aciona `perdeuAcesso()`.
- OS (`ordens-servico`): abrir não altera o bem; aprovar (admin) aplica o efeito; manutenção fica `aprovada` até concluir. Depreciação: valores e memória de cálculo vêm prontos do servidor (não recalcular); ajuda é Markdown renderizado por `renderizarMarkdown` (HTML cru é escapado). Competências usam `yyyy-MM` na rota.
- Errors: `lerErroApi()` handles both `{ error }` (business rule) and ASP.NET `errors` (per field); `aplicarErroNoForm()` puts them on form controls (keyword → field map for `{ error }` messages). Export errors arrive as `Blob` — `ImobBemService.exportar` rebuilds them.
- Lists: server-paged, `pageSize` max 100 (default 50), filters sent only when defined (`montarParams`). The bens list keeps filters **in the URL** (query params are the source of truth, which is what the "Ver bens" links from base registers use: `?localId=`, `?categoriaId=`, `?responsavelId=`).
- Deleting a local/categoria/responsável that has bens returns `400`; screens show `app-bloqueio-exclusao` offering "Desativar" (full `PUT` with `ativo: false`) and a link to the filtered bens list.
- Bem `dataAquisicao`/`valorAquisicao`/`valorResidual` are optional; without date or value `dadosCompletos` is `false` (badge "Dados incompletos", list filter `?dadosCompletos=false` = "Pendentes de completar"). Residual can't be sent without valor.
- CSV import (`bens/importar`, admin/operador): validate → report → confirm resending the **same `File`** + `hashArquivo` (`FormData`, no manual Content-Type); changing file or default local invalidates the report; error report CSV is built in the browser.
- Inventários (`inventarios`, `/novo`, `/:id`, `/:id/editar`): status `rascunho → em_andamento → concluido|cancelado`; edit in rascunho/em_andamento (scope `localIds` frozen once started — the form disables it but still sends the current ids), iniciar freezes the expected list (confirm dialog), cancelar from rascunho/em_andamento, excluir (admin) only rascunho/cancelado. Team picker uses `GET empresas/{id}/usuarios` (admin-only endpoint); operadores see the team read-only and it is preserved on save.
- Bem `status` is read-only (comes from OS/inventory in later phases); `baixado`/`vendido` bens can't be edited (`bemEditavel()`).
- Bem form: on create, category pre-fills vida útil and residual (value = % × aquisição) until the user edits them; untouched fields are **omitted** from the payload so the server applies the category values. On edit nothing is pre-filled and current values are sent.
- Formatting: use `Intl` helpers in `imob-formato.ts` (BRL, `dd/MM/yyyy` without `Date` parsing, `%`). The app does **not** register the `pt-BR` locale, so don't use `DecimalPipe`/`CurrencyPipe`/`DatePipe` with `'pt-BR'`.
- Angular `@if (...; as x)` alias only works on the first `@if` block; use `@let` otherwise.
- CSV export and any download needing the header: `HttpClient` + `responseType: 'blob'` + `baixarBlob()`, never `<a href>` to the API.

### Testing

- Specs use Jasmine + `HttpTestingController`; roles via `provideAuthFake(role)`. Stub `Modal.prototype.show/hide` in specs that open Bootstrap modals (the fade animation otherwise finishes after teardown and breaks Karma).
- `fixture.whenStable()` does **not** wait for router navigation or `Blob.text()` — await a `NavigationEnd` / poll instead.
- Run headless: `npx ng test --watch=false --browsers=ChromeHeadless` (add `--include='src/app/features/imobilizado/**/*.spec.ts'` to narrow).

---

## Key models

### `ConferenciaResult` (`core/models/conferencia.model.ts`)

```ts
{
  produtoId, sku, nome, categoria,
  saldoAtual, totalEntradas, totalSaidas,
  precoMedio, valorTotalEstoque, valorTotalMovimentado,
  ultimaMovimentacao: string | null,
  primeiraMovimentacao: string | null
}
```

`ultimaMovimentacao` and `primeiraMovimentacao` are null when no movements exist in the filtered period.

### `Movimentacao` (`core/models/movimentacao.model.ts`)

`tipo` values: `'entrada' | 'saida' | 'ajuste' | 'ajuste_saida'`.

`motivoAjuste` values (optional, used with ajuste/ajuste_saida): `'inventario' | 'quebra' | 'furto' | 'vencimento' | 'erro_lancamento' | 'devolucao' | 'outro'`.

Movimentações support `PUT /v1/movimentacoes/{id}` and `DELETE /v1/movimentacoes/{id}`. Additional read endpoints:
- `GET /v1/movimentacoes/produto/{produtoId}` — movements for a specific product
- `GET /v1/movimentacoes/nota-fiscal/{notaFiscalId}` — movements linked to a NF
- `GET /v1/movimentacoes/saldo/{produtoId}` — current stock balance for a product

### `User`

`role` values: `'admin' | 'operador' | 'leitura'`

---

## Key conventions

- `@if` / `@for` — Angular 17+ built-in control flow (never `*ngIf` / `*ngFor`)
- All forms use Angular Reactive Forms with `markAllAsTouched()` on invalid submit
- Services use `map(res => res.items)` to unwrap the paged response, then `tap` into `signal.set(data)`
- Optional HTTP filters are passed as `HttpParams`, only set when the value is defined
