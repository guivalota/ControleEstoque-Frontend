# Controle de Estoque — Frontend

Aplicação web (SPA) para controle de **estoque** e de **ativos imobilizados (patrimônio)**, consumindo a API `controle-estoque-dotnet`.

- Produção: https://guivalota.github.io/ControleEstoque-Frontend/
- Stack: Angular 19 (componentes standalone, signals, Reactive Forms), Bootstrap 5, RxJS, testes com Jasmine/Karma.

## Módulos

### Estoque
Dashboard, categorias, produtos, fornecedores, clientes, notas fiscais (importação de NF-e), movimentações (entrada, saída, ajustes), conferência de estoque, lotes com validade, pedidos de compra, impressões, usuários, logs de auditoria e manual.

### Imobilizado (multiempresa)
Área própria em `/imobilizado`, com a empresa ativa enviada em todas as chamadas (`X-Empresa-Id`).

| Funcionalidade | Descrição |
|---|---|
| Empresas e vínculos | Administração de empresas e usuários, com perfil por empresa (admin) |
| Cadastros base | Locais (árvore), categorias de bem, responsáveis |
| Bens | Lista com filtros na URL, formulário, detalhe com histórico, dados incompletos, exportação e importação por CSV |
| Etiquetas | PDF com QR por seleção, por filtro ou pelo detalhe do bem (modelos A4 e rolo) |
| Inventários | Escopo e equipe, contagem (leituras e CSV), conciliação, painel de divergências, encerramento e relatório |
| Ordens de serviço | Transferência, manutenção, baixa e venda, com fluxo de aprovação |
| Depreciação | Prévia, fechamento de períodos, razão, relatórios e memória de cálculo |

Perfis: `admin`, `operador` e `leitura`. No Imobilizado vale o menor entre o perfil global e o perfil na empresa.

## Pré-requisitos

- Node.js 20
- npm
- Chrome (para os testes)

## Como rodar

```bash
npm ci
npm start        # http://localhost:4200
```

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/controle-estoque/` |
| `npm test` | Testes unitários (Karma) |
| `npx ng test --watch=false --browsers=ChromeHeadless` | Testes sem interface, como no CI |
| `npx eslint <caminhos>` | Lint apenas dos arquivos alterados (o código legado do Estoque ainda tem erros antigos) |

## Configuração da API

| Ambiente | Arquivo | `apiUrl` |
|---|---|---|
| Desenvolvimento | `src/environments/environment.ts` | `/api` (proxy) |
| Produção | `src/environments/environment.prod.ts` | URL base da API, sem `/v1` |

Em desenvolvimento, o `proxy.conf.json` encaminha `/api/*` para `http://localhost:5062`, removendo o prefixo `/api`. Suba o backend localmente ou ajuste o `target` do proxy. Cada serviço acrescenta `/v1/...` à URL.

A API usada em produção precisa estar acessível publicamente a partir do navegador de quem usa o site. **Ao trocar a URL da API, atualize também a diretiva `connect-src` da CSP em `src/index.html`**: sem isso o navegador bloqueia todas as chamadas, e o login parece falhar sem que a API seja consultada.

### Credenciais para testes manuais

Ficam em `.env.local`, na raiz do projeto (não versionado):

```
API_URL=<url base da API>
API_EMAIL=<email>
API_SENHA=<senha>
```

O login é `POST /v1/auth/login` com `{ "email", "senha" }`. Nunca versione esse arquivo.

## Estrutura

```
src/app/
  core/        guards, interceptors, models, services, utils
  layout/      shell, sidebar, topbar
  features/    uma pasta por módulo (rotas lazy-loaded)
    imobilizado/   área de patrimônio (shell, bens, inventários, OS, depreciação...)
docs/imobilizado/  especificações de contrato da API para o Imobilizado
```

Convenções do projeto (estado com signals, modais Bootstrap, paginação, formatação, tratamento de erros, multiempresa) estão no [CLAUDE.md](CLAUDE.md). As especificações por funcionalidade estão em [docs/imobilizado](docs/imobilizado); leia-as antes de alterar endpoints, mensagens de erro ou tipos.

## Fluxo de trabalho e deploy

| Branch | Função |
|---|---|
| `master` | Produção; protegida, merge só por PR com 1 aprovação |
| `develop` | Base para novas features e correções |

1. Trabalhe em `develop` ou em uma branch de feature.
2. Abra um PR para `master` e aguarde a aprovação.
3. No merge, o workflow `.github/workflows/deploy.yml` roda `npm ci` e `npm run build`, copia `index.html` para `404.html` (rotas da SPA) e publica na branch `gh-pages`, servida pelo GitHub Pages.

O build de produção usa `baseHref` `/ControleEstoque-Frontend/`. O workflow não executa testes nem lint; rode-os localmente antes de abrir o PR.
