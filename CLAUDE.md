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

API runs at `http://localhost:5062` (configured in `src/environments/environment.ts`).

**Test credentials** — `POST /auth/login` with body `{ "email": "admin@estoque.com", "senha": "Admin@1234" }`.  
Note: the login field is `senha`, not `password`. Response: `{ accessToken, refreshToken, expiresIn }`.

### API response format

**All list endpoints return plain arrays** — `T[]` directly, never wrapped.  
Do NOT use `ApiResult<T>` / `res.value` patterns. Services type as `http.get<T[]>(url)`.

The `ApiResult<T>` interface in `nota-fiscal.model.ts` is legacy and unused — do not reintroduce it.

### Query parameter casing per endpoint

All query params are **PascalCase** across all endpoints.

| Endpoint | Params |
|---|---|
| `GET /movimentacoes` | `DataInicio`, `DataFim`, `CategoriaId`, `ProdutoId`, `Page`, `PageSize` |
| `GET /conferencia` | `DataFim`, `CategoriaId`, `ApenasComSaldo`, `AbaixoDoMinimo`, `Page`, `PageSize` |
| `GET /conferencia/{produtoId}` | `DataInicio`, `DataFim` |

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

`POST /auth/login` → stores `accessToken` + `refreshToken` in `localStorage` under keys `ce_token` / `ce_refresh` → `AuthService.decodeToken()` parses JWT with `atob()` → exposes `currentUser` signal → `authInterceptor` injects `Authorization: Bearer {token}` → `authGuard` checks `isAuthenticated()` computed signal (verifies `exp * 1000 > Date.now()`).

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

Movimentações support `PUT /movimentacoes/{id}` and `DELETE /movimentacoes/{id}`. Additional read endpoints:
- `GET /movimentacoes/produto/{produtoId}` — movements for a specific product
- `GET /movimentacoes/nota-fiscal/{notaFiscalId}` — movements linked to a NF
- `GET /movimentacoes/saldo/{produtoId}` — current stock balance for a product

### `User`

`role` values: `'admin' | 'operador' | 'leitura'`

---

## Key conventions

- `@if` / `@for` — Angular 17+ built-in control flow (never `*ngIf` / `*ngFor`)
- All forms use Angular Reactive Forms with `markAllAsTouched()` on invalid submit
- Services do not use `map` to unwrap responses — `tap` directly into `signal.set(data)`
- Optional HTTP filters are passed as `HttpParams`, only set when the value is defined
