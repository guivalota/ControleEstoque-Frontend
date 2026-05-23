# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server → http://localhost:4200
npm run build      # production build → dist/controle-estoque/
npm test           # unit tests via Karma
ng lint            # ESLint
```

## Backend

API runs at `https://controle-estoque-dotnet-production.up.railway.app` (production).  
Dev proxy in `proxy.conf.json` forwards `/api/*` → Railway (strips `/api`, keeps `/v1/...`).  
`environment.ts` uses `apiUrl: '/api/v1'` (dev via proxy) · `environment.prod.ts` uses the full Railway URL.

**Test credentials** — `POST /v1/auth/login` with body `{ "email": "admin@example.com", "senha": "Admin@123456" }`.  
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
