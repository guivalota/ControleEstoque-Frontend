# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server → http://localhost:4200
npm run build      # production build → dist/controle-estoque/
npm test           # unit tests via Karma
ng lint            # ESLint
```

API backend must be running at `http://localhost:5062` (configured in `src/environments/environment.ts`).

## Architecture

**Angular 19 · Standalone components · Bootstrap 5 · Signals**

```
src/app/
  core/
    guards/auth.guard.ts          # functional guard — redirects to /login if not authenticated
    interceptors/auth.interceptor.ts  # adds Bearer token to every request
    models/                       # TypeScript interfaces (auth, categoria, produto, movimentacao, user)
    services/                     # one service per domain resource; each holds a signal<T[]>
  layout/
    shell/                        # root layout: sidebar + topbar + <router-outlet>
    sidebar/                      # nav links with routerLinkActive
    topbar/                       # current user name/role + logout button
  features/
    auth/login/                   # login form, navigates to /dashboard on success
    dashboard/                    # KPI cards + last 10 movements (reads from 3 services)
    produtos/                     # CRUD with Bootstrap Modal; includes category select
    categorias/                   # CRUD with Bootstrap Modal
    movimentacoes/                # create-only (entries, exits, adjustments) + filter by product
    users/                        # CRUD with Bootstrap Modal; role: admin | operador | leitura
```

### Routing

`/login` is unguarded. All other routes are under a `ShellComponent` parent protected by `authGuard`. Every feature is lazy-loaded via `loadComponent`.

### State management

Each service exposes a `signal<T[]>` (e.g., `produtos = signal<Produto[]>([])`). After every mutation (create/update), `getAll()` is called via `switchMap` to refresh the signal. Delete uses optimistic update via `signal.update()`. Components read signals directly — no subscriptions needed in templates.

### Auth flow

`POST /auth/login` → stores `token` + `refreshToken` in `localStorage` → `AuthService` decodes the JWT payload with `atob()` to expose `currentUser` signal → `authInterceptor` injects `Authorization: Bearer {token}` → `authGuard` checks `isAuthenticated()` computed signal (verifies `exp * 1000 > Date.now()`).

### Bootstrap Modals

Components that need modals import `Modal` from `'bootstrap'` (typed via `src/typings.d.ts`). Each component holds a `private modal!: Modal` instance initialised lazily on first open using `@ViewChild('modalEl')`. Always call `modal.dispose()` in `ngOnDestroy`.

### Key conventions

- Movimentação `tipo` values: `'entrada' | 'saida' | 'ajuste'`
- User `role` values: `'admin' | 'operador' | 'leitura'`
- Movimentações are **immutable** — no edit/delete endpoints exist
- All forms use Angular Reactive Forms with `markAllAsTouched()` on invalid submit
- `@if` / `@for` use Angular 17+ built-in control flow syntax (not `*ngIf` / `*ngFor`)
