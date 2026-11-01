# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Documentação do produto** (decisões D-NNN, pendências PEND-NNN, specs): `../design/` (índice em `../design/README.md`), `../backlog/` (épicos E01-E18) e `../SPEC.md`. Aqui ficam só comandos, padrões e armadilhas do front; em conflito, vale `../design/`. O antigo `handoff.md` foi arquivado em `../design/_origem/handoff.md` (histórico).

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

API runs on a local Docker host exposed by **Tailscale Funnel** (temporary hosting; Railway and ngrok are no longer used). Current URL: see `src/environments/environment.prod.ts`.  
Dev proxy in `proxy.conf.json` forwards `/api/*` → the dev API (strips `/api`, keeps `/v1/...`).  
`environment.ts` uses `apiUrl: '/api'` (dev via proxy) · `environment.prod.ts` uses the Tailscale Funnel base URL (no `/v1`). If the URL changes, update `environment.prod.ts` and the CSP `connect-src` in `src/index.html` together.  
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
core/services/empresa-ativa.service.ts    # active company state (signals); no persisted selection (only `imob.empresaBloqueadaId`, PEND-14)
core/services/imob-{empresa,local,categoria,responsavel,bem}.service.ts   # stateless: return Observables, no signals
core/interceptors/empresa.interceptor.ts  # X-Empresa-Id + 403 handling
core/guards/empresa-ativa.guard.ts        # imobilizadoGuard (loads companies) + empresaAtivaGuard (canActivateChild)
core/guards/escrita.guard.ts              # create/edit routes: admin/operador only
core/utils/                               # cnpj, erros-api, http-params, imob-formato (BRL/date/%/vida útil), historico-formato, local-arvore, validadores, download
features/imobilizado/
  shell/        # area header (active company), tabs, "sem acesso" screen
  empresas/     # company admin + user links (admin only)
  locais/ categorias/ responsaveis/   # base registers
  bens/         # list, form, detail (+ Histórico tab), CSV export
  shared/       # confirm-dialog, paginacao, seletor-local (CVA), autocomplete-responsavel (CVA), bloqueio-exclusao
testing/auth-fake.ts   # provideAuthFake(role) for specs
```

Routes: `/imobilizado` (shell, `imobilizadoGuard`) → children `bens`, `bens/importar`, `bens/novo`, `bens/:id/editar`, `bens/:id` (abas Dados · Histórico · Depreciação), `inventarios*` (`/:id/contagem`, `/:id/conciliacao`), `ordens-servico` (`/nova`, `/:id`), `depreciacao` (`/fechamento`, `/periodos/:mes`, `/relatorios`, `/ajuda`), `locais`, `categorias`, `responsaveis`, `empresas`, `empresas/:id/usuarios`.

Estoque também tem `lotes` (CRUD + validade; params PascalCase) e `loteId` opcional na criação de movimentações.

### Multi-company (X-Empresa-Id)

> **Atualizado 2026-10-26:** o `empresaInterceptor` envia `X-Empresa-Id` em **toda** rota `/v1/**` de dados (Estoque, clientes, fornecedores, CEP, `empresa-ativa/usuarios`, imobilizado), exceto auth, users, plataforma, audit-logs, version, `minhas-empresas`, `empresas` e FAQ de depreciação. A empresa ativa é carregada no shell (`cargaEmpresaGuard`) para qualquer módulo; menu e rotas filtram por `modulos` (`moduloGuard`, `moduloInterceptor`) e as permissões do Estoque usam o **perfil** da empresa ativa. Fluxos novos: `/definir-senha` (senha provisória, `senhaProvisoriaInterceptor`) e `/plataforma` (placeholder do super admin; `superAdminGuard`/`contaEmpresaGuard`). Lista de usuários da empresa: `GET v1/empresa-ativa/usuarios` (`UsuarioEmpresaService`); `GET v1/users` é só do super admin. O restante desta seção descreve o Imobilizado e vale com essas ressalvas.

- Every data call to `v1/imobilizado/**` carries `X-Empresa-Id` (set by `empresaInterceptor`). **No header** for `minhas-empresas` and `empresas/**` (admin). Never send `empresaId` in body or query.
- **Um usuário, uma empresa (D-031/D-035, PEND-057):** não há seletor, modal nem ação "Trocar empresa". `GET minhas-empresas` devolve no máximo 1 empresa (cliente e plataforma: 1 vínculo; super admin: nenhum). `EmpresaAtivaService.carregar()` usa o único vínculo como empresa ativa; 0 empresas (ou empresa bloqueada) → tela "sem acesso" com a mensagem de bloqueio (sonda via `imob.empresaBloqueadaId`). Se dados legados trouxerem 2+, usa a primeira sem quebrar. A seleção não é mais persistida (a chave antiga `imob.empresaId` é apenas removida). `imobilizadoGuard`/`cargaEmpresaGuard` carregam a empresa; o `<router-outlet>` é recriado (chave = id da empresa) quando ela é recarregada; no logout/troca de usuário `garantirCarregada` zera o estado.
- A `403` on a data call → `perdeuAcesso()`: zera a empresa, recarrega a lista, shows "Seu acesso a esta empresa foi alterado.".
- Routes marked `data: { dispensaEmpresa: true }` skip `empresaAtivaGuard`; `data: { administracao: true }` (company admin screens) also render without an active company and don't force the selector. Even admins must be linked to a company to see its data.

### Navegação, dashboard e tema (E21)

- **Menu lateral (`layout/sidebar`)**: Estoque e Imobilizado são **grupos com subitens** (botão + `<ul class="sidebar-sub">`). O submenu fica **sempre no DOM** (só `.aberto` o mostra), porque os specs e a acessibilidade dependem dos links presentes. Estado: `aberto(chave)` = escolha manual (`manual` signal) ou, se não houver, "a URL está dentro do grupo" (`ROTAS_GRUPO`); ao navegar para dentro de um grupo a escolha manual dele é descartada. Chaves: `estoque`, `imob`, `imob-cad` (Cadastros), `imob-reav` (Reavaliação). Rota nova do Imobilizado = acrescentar o link no grupo **e**, se for de um prefixo novo, em `ROTAS_GRUPO`. O shell do Imobilizado não tem mais abas.
- **Dashboard (`/imobilizado`, `features/imobilizado/inicio`)**: sem endpoint próprio; compõe `depreciacao/dashboard`, `inventarios?status=em_andamento`, `ordens-servico?status=pendente`, `bens?dadosCompletos=false` e `bens/codigo-anterior` (todos com `pageSize=1`, só o `total`). Cada chamada falha sozinha (`catchError` → bloco omitido), porque perfis enxergam partes diferentes.
- **Entrada padrão**: `/` e o login vão para `/dashboard` (Estoque). `moduloGuard('estoque')` redireciona para `empresa.rotaInicial()` **sem aviso** quando o destino é exatamente `/dashboard`; qualquer outra rota negada continua avisando "Seu plano não inclui este módulo.".
- **Botões**: ação principal `btn-primary`, demais `btn-outline-primary` (não misturar `btn-outline-secondary` na mesma barra).
- **Tema**: escuro por padrão (`ThemeService`, chave `ce_theme`; só `light` guardado mantém o claro) e `<html data-bs-theme="dark">` no `index.html` para não piscar.
- **Renovação de etiquetas / conferência**: tela `bens/renovar-etiquetas` (virada, de-para CSV, PDF de conferência), `ImobCodigoAnteriorService` (estado da virada compartilhado), `ImobBemService.conferenciaPdf(filtro)` (blob via `baixar()`, mesmo mecanismo do CSV). O botão "Conferência (PDF)" da lista usa os filtros ativos.

### Conventions specific to this area

- Roles via `PermissaoService`. No Imobilizado use `imobCanCreate`/`imobCanEdit`/`imobCanDelete` (perfil **efetivo** = `EmpresaAtiva.perfil` como o servidor devolve em `minhas-empresas`/`empresa-ativa`; **não** recombinar com a role do token: conta cliente tem role global `leitura` e perfil admin no vínculo). O banner "somente leitura" do shell usa esse perfil dentro de `/imobilizado`. `canCreate`/`canEdit`/`canDelete` ficam para o Estoque. Hide write buttons **and** protect routes (`adminGuard`, `escritaGuard`); the backend is the real authority.
- 403 com `{ error }` (perfil, equipe do inventário, dono da OS) mantém a tela e mostra a mensagem; só `Sem acesso à empresa...` (ou 403 sem mensagem) aciona `perdeuAcesso()`.
- OS (`ordens-servico`): abrir não altera o bem; aprovar (admin) aplica o efeito; manutenção fica `aprovada` até concluir. Depreciação: valores e memória de cálculo vêm prontos do servidor (não recalcular); ajuda é Markdown renderizado por `renderizarMarkdown` (HTML cru é escapado). Competências usam `yyyy-MM` na rota.
- Errors: `lerErroApi()` handles both `{ error }` (business rule) and ASP.NET `errors` (per field); `aplicarErroNoForm()` puts them on form controls (keyword → field map for `{ error }` messages). Export errors arrive as `Blob` — `ImobBemService.exportar` rebuilds them.
- Lists: server-paged, `pageSize` max 100 (default 50), filters sent only when defined (`montarParams`). The bens list keeps filters **in the URL** (query params are the source of truth, which is what the "Ver bens" links from base registers use: `?localId=`, `?categoriaId=`, `?responsavelId=`).
- Deleting a local/categoria/responsável that has bens returns `400`; screens show `app-bloqueio-exclusao` offering "Desativar" (full `PUT` with `ativo: false`) and a link to the filtered bens list.
- Bem `dataAquisicao`/`valorAquisicao`/`valorResidual` are optional; without date or value `dadosCompletos` is `false` (badge "Dados incompletos", list filter `?dadosCompletos=false` = "Pendentes de completar"). Residual can't be sent without valor.
- CSV import (`bens/importar`, admin/operador): validate → report → confirm resending the **same `File`** + `hashArquivo` (`FormData`, no manual Content-Type); changing file or default local invalidates the report; error report CSV is built in the browser.
- Inventários (`inventarios`, `/novo`, `/:id`, `/:id/editar`): status `rascunho → em_andamento → concluido|cancelado`; edit in rascunho/em_andamento (scope `localIds` frozen once started — the form disables it but still sends the current ids), iniciar freezes the expected list (confirm dialog), cancelar from rascunho/em_andamento, excluir (admin) only rascunho/cancelado. Team picker uses `GET empresas/{id}/usuarios` (admin-only endpoint); operadores see the team read-only and it is preserved on save.
- Bem `status` is read-only (comes from OS/inventory in later phases); `baixado`/`vendido` bens can't be edited (`bemEditavel()`).
- Bem form: on create, category pre-fills only vida útil until the user edits it (untouched = **omitted**, the server applies the category value). The residual is **not** derived from the category any more (D-036/PEND-090: empty = zero; the category % is just a "referência"); on edit an empty residual keeps the current value. `departamentoId` is an optional select (active ones + the bem's current). Field errors `DataAquisicao`/`ValorResidual` come as ASP.NET `errors` and land on the form controls.
- E19 screens: `departamentos` (CRUD), `reavaliacao/estados-conservacao`, `reavaliacao/pesos`, `reavaliacao/escalas` (VP/VF range editor, validation in `core/utils/escala-faixas.ts`). Parameter screens are read for everyone and editable only where `podeEditarParametros()` (`features/imobilizado/parametros/pode-editar-parametros.ts`, today admin) says so; that is the single place to release the contador profile later. Bens list also filters by `departamentoId`, `compraDe`/`compraAte` and sorts by `ordenarPor`/`direcao` (all in the URL).
- Formatting: use `Intl` helpers in `imob-formato.ts` (BRL, `dd/MM/yyyy` without `Date` parsing, `%`). The app does **not** register the `pt-BR` locale, so don't use `DecimalPipe`/`CurrencyPipe`/`DatePipe` with `'pt-BR'`.
- Angular `@if (...; as x)` alias only works on the first `@if` block; use `@let` otherwise.
- Etiquetas (spec 5.2): `ImobEtiquetasDialogComponent` (shared) recebe `abrir({ ids } | { filtro, total }, modelo?)`; PDF vem como blob (`ImobEtiquetaService.gerar`), pré-visualização em `<iframe>` via object URL, `ids` ignora os filtros, limite de 500 por pedido (erros 400 do servidor são exibidos). Seleção por checkbox na lista de bens; "Imprimir etiqueta" (`rolo-50x30`) no detalhe. O QR é gerado no servidor.
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
