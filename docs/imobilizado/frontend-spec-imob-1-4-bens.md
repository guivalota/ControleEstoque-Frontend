# Spec de Frontend — Imobilizado: Bens (Fase 1.4)

> Backend na branch `tbrt-imobilizado` (migration `0016_imob_bens`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (empresa ativa / `X-Empresa-Id`), `1-1-locais`, `1-2-categorias` e `1-3-responsaveis` (os selects do formulário vêm deles).

---

## Visão geral

Bem é uma unidade patrimonial única, identificada por **plaqueta**, com local, categoria, responsável (opcional) e dados de aquisição. É isolado por empresa e **não** tem relação com produtos/fornecedores do Estoque (fornecedor é só texto livre).

- **Todos** os endpoints exigem `X-Empresa-Id`.
- Roles: leitura (`GET`, exportação) — `admin`, `operador`, `leitura`; criar/editar — `admin`, `operador`; excluir — `admin`.
- Bem (ou categoria/local/responsável) de outra empresa é indistinguível de inexistente: `GET` → `404`; `PUT`/`DELETE`/referência em `POST` → `400` "não encontrado".
- Toda criação/edição/exclusão grava uma **trilha de alterações** no servidor (quem, quando, campo, valor anterior/novo). A consulta (`GET bens/{id}/historico`) está descrita em `frontend-spec-imob-1-5-historico-bem.md`.

### Status do bem

`ativo` · `em_manutencao` · `baixado` · `vendido` · `extraviado`

- Todo bem nasce `ativo`. **O status não é editável por esta API**: ele mudará pelos fluxos de Ordem de Serviço (manutenção, baixa, venda, sinistro — Fase 3) e de Inventário (Fase 2). Até lá, na prática todos os bens estão `ativo`; o filtro por status já funciona.
- Bens `baixado`/`vendido` não podem mais ser editados (`400`).
- Se o front enviar `status` no corpo do `PUT`, o campo é ignorado.

---

## 1. Listar — `GET /v1/imobilizado/bens`

| Query | Tipo | Descrição |
|---|---|---|
| `busca` | `string` | Contém, sem diferenciar maiúsculas, em `plaqueta`, `descricao` ou `numeroSerie` (`%` e `_` são literais) |
| `localId` | `number` | Bens deste local |
| `incluirSublocais` | `bool` | Padrão `true`: com `localId`, inclui os bens de **todos os sublocais**. `false` = só o local exato |
| `categoriaId` | `number` | Filtra por categoria |
| `responsavelId` | `number` | Filtra por responsável |
| `status` | `string` | Um dos status acima (qualquer outro valor → `400`) |
| `dadosCompletos` | `bool` | `false` = só bens com data **ou** valor de aquisição pendentes; `true` = só completos; omitido = todos |
| `page` / `pageSize` | `number` | Padrão 1 / 50; **`pageSize` máximo 100** |

Ordenado por plaqueta. Resposta paginada `{ items, page, pageSize, total }`; cada item:

```json
{
  "id": 42, "plaqueta": "NB-0001", "descricao": "Notebook Dell Latitude",
  "categoriaId": 3, "categoriaNome": "Informática",
  "localId": 7, "localNome": "Sala 101",
  "responsavelId": 12, "responsavelNome": "Ana Souza",
  "dataAquisicao": "2024-03-10", "valorAquisicao": 4500.00, "valorResidual": 450.00,
  "vidaUtilMeses": 60, "dadosCompletos": true, "status": "ativo",
  "fornecedorNome": "Dell Brasil", "numeroDocumentoAquisicao": "NF-12345", "numeroSerie": "SN-9988",
  "observacao": null, "criadoEm": "2026-10-22T14:03:11Z", "atualizadoEm": "2026-10-22T14:03:11Z"
}
```

Nomes de categoria/local/responsável já vêm no item — não é preciso consultar os cadastros para renderizar a tabela.

## 2. Detalhe — `GET /v1/imobilizado/bens/{id}`

`200` com o item ou `404` `{ "error": "Bem com id X não encontrado." }`.

## 3. Busca por plaqueta — `GET /v1/imobilizado/bens/por-plaqueta?plaqueta=NB-0001`

Busca **exata**, sem diferenciar maiúsculas — para leitor de código de barras/QR e campo "ir para plaqueta". `200` com o item ou `404`. A plaqueta vai em query string (não no caminho) porque pode conter `/`; lembre de codificar com `encodeURIComponent`/`HttpParams`.

## 4. Criar — `POST /v1/imobilizado/bens`

```json
{
  "plaqueta": "NB-0001", "descricao": "Notebook Dell Latitude",
  "categoriaId": 3, "localId": 7, "responsavelId": 12,
  "dataAquisicao": "2024-03-10", "valorAquisicao": 4500.00,
  "valorResidual": 450.00, "vidaUtilMeses": 60,
  "fornecedorNome": "Dell Brasil", "numeroDocumentoAquisicao": "NF-12345",
  "numeroSerie": "SN-9988", "observacao": "Garantia até 03/2027"
}
```

| Campo | Regra |
|---|---|
| `plaqueta` | Obrigatória, máx. 50; espaços nas pontas removidos; **única na empresa** sem diferenciar maiúsculas (pode ser reutilizada após excluir o bem) |
| `descricao` | Obrigatória, máx. 500 |
| `categoriaId` | Obrigatório; categoria **ativa** da empresa |
| `localId` | Obrigatório; local **ativo** da empresa |
| `responsavelId` | Opcional; responsável **ativo** da empresa |
| `dataAquisicao` | **Opcional** (`yyyy-MM-dd`); se informada, entre 01/01/1900 e hoje. Ver "Bens com dados incompletos" abaixo |
| `valorAquisicao` | **Opcional**; se informado, ≥ 0 (2 casas) |
| `valorResidual` | Opcional. **Omitido** → calculado como `valorAquisicao × % residual da categoria`. Deve ser ≤ `valorAquisicao`. **Só pode ser informado junto com `valorAquisicao`** (senão `400`); sem valor de aquisição o residual fica `null` |
| `vidaUtilMeses` | Opcional (1–1200). **Omitido** → vida útil da categoria |
| `fornecedorNome` (255), `numeroDocumentoAquisicao` (100), `numeroSerie` (100), `observacao` (2000) | Opcionais, texto livre |

`201` + item completo (com nomes e valores efetivos de residual/vida útil). Erros `400` `{ "error": "..." }` (ou formato `errors` do ASP.NET para validação de formato): plaqueta duplicada, categoria/local/responsável inexistente, de outra empresa ou inativo, residual > aquisição, data fora do intervalo.

**Dica de UX:** ao escolher a categoria, pré-preencha vida útil e % residual (já vêm no cadastro de categoria) e deixe editáveis; se o usuário não mexer, pode omitir os campos.


### Bens com dados incompletos

Data e valor de aquisição são **opcionais**: inventários reais têm bens sem histórico de compra. Um bem sem data **ou** sem valor tem `dadosCompletos: false` e fica **fora da depreciação** (Fase 4) até ser completado.

- Mostre um selo "Dados incompletos" na lista e no detalhe, e ofereça o filtro `?dadosCompletos=false` (ex.: aba/atalho "Pendentes de completar").
- Para completar, use o `PUT`. Ao informar o valor de aquisição de um bem que estava sem valor e sem residual, o servidor calcula o residual pelo % da categoria (a menos que você envie `valorResidual`).
- Remover o `valorAquisicao` no `PUT` (enviar `null`/omitir) limpa também o residual.
- Na exportação CSV, data/valores pendentes saem como células vazias.

## 5. Editar — `PUT /v1/imobilizado/bens/{id}`

Mesmo corpo do criar (edição completa do cadastro; campos opcionais de texto omitidos viram `null`). Diferenças:

- `valorResidual` e `vidaUtilMeses` omitidos **mantêm o valor atual** (não são recalculados pela categoria).
- Categoria/local/responsável só são validados como "ativos" **se forem trocados** — editar um bem cujo local ficou inativo continua permitido.
- Mudar `localId`/`responsavelId` aqui é uma **correção cadastral** e fica registrada no histórico; transferências formais com aprovação virão como Ordem de Serviço (Fase 3).
- Bem `baixado`/`vendido` → `400` "não pode ser editado".

`200` + item atualizado.

## 6. Excluir — `DELETE /v1/imobilizado/bens/{id}`

**Role:** `admin`. Exclusão lógica (`204`); a exclusão fica no histórico.

### Efeito sobre os cadastros-base (atualização das specs 1.1–1.3)

A partir desta fatia, **não é possível excluir** (`400`, mensagem em `error`) um **local**, **categoria** ou **responsável** que ainda tenha bens (não excluídos):

- "Não é possível excluir um local que possui bens."
- "Não é possível excluir uma categoria que possui bens."
- "Não é possível excluir um responsável que possui bens."

Desativar continua permitido e não afeta bens existentes. Sugestão: na tela do cadastro-base, ao receber esse `400`, oferecer "Desativar" e/ou link para a lista de bens filtrada (`?localId=`, `?categoriaId=`, `?responsavelId=`).

## 7. Exportar CSV — `GET /v1/imobilizado/bens/exportar`

Aceita **os mesmos filtros** da listagem (`busca`, `localId`, `incluirSublocais`, `categoriaId`, `responsavelId`, `status`); ignora `page`/`pageSize`. Resposta: arquivo `bens.csv` (`text/csv`, UTF-8).

Colunas: `Plaqueta, Descricao, Categoria, Local, Responsavel, Status, DataAquisicao, ValorAquisicao, ValorResidual, VidaUtilMeses, NumeroSerie, Fornecedor, DocumentoAquisicao, Observacao` (datas `yyyy-MM-dd`, valores com ponto decimal, textos entre aspas; células que começam com `= + - @` recebem `'` na frente para evitar execução de fórmula em planilhas).

**Limite:** 20.000 bens por exportação. Se o filtro retornar mais, a API responde `400` "A exportação é limitada a 20000 bens e o filtro retornou N. Refine os filtros." — mostre a mensagem e sugira filtrar por local/categoria.

Como o download precisa do header `X-Empresa-Id`, **não use `<a href>`**: faça a chamada via `HttpClient` (`responseType: 'blob'`) e salve o blob.

```typescript
exportarBens(filtro: ImobBemFiltro) {
  return this.http.get(`/v1/imobilizado/bens/exportar`, { params: toParams(filtro), responseType: 'blob' });
}
```

---

## 8. Sugestão de UI

```
┌─ Bens ───────────────────────────────  [+ Novo bem]  [⭳ Exportar CSV] ┐
│ Buscar: [plaqueta, descrição ou série__]  Local: [Matriz ▾] [x] c/ sublocais │
│ Categoria: [Todas ▾]  Responsável: [Todos ▾]  Status: [Todos ▾]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Plaqueta  Descrição            Local      Responsável  Valor      Status    │
│ NB-0001   Notebook Dell        Sala 101   Ana Souza    4.500,00   ● Ativo   │
│ MS-0002   Mesa de reunião      Sala 101   —            1.200,00   ● Ativo   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Campo de busca rápida por plaqueta (Enter → `por-plaqueta`; `404` → "plaqueta não encontrada").
- Seletor de local como árvore (`GET locais/arvore`), com a opção "incluir sublocais" ligada por padrão.
- Selects de categoria/responsável: `ativo=true`; para responsáveis use autocomplete (`busca`, `pageSize=20`).
- Criar/editar ocultos para `leitura`; excluir só para `admin`. Em `400`, exibir `error`.
- Formatar `valorAquisicao`/`valorResidual` em BRL na exibição; enviar números.

## 9. Tipos TypeScript

```typescript
export type ImobBemStatus = 'ativo' | 'em_manutencao' | 'baixado' | 'vendido' | 'extraviado';

export interface ImobBem {
  id: number;
  plaqueta: string;
  descricao: string;
  categoriaId: number; categoriaNome: string;
  localId: number; localNome: string;
  responsavelId?: number | null; responsavelNome?: string | null;
  dataAquisicao?: string | null;   // yyyy-MM-dd
  valorAquisicao?: number | null;
  valorResidual?: number | null;
  dadosCompletos: boolean;        // false = falta data ou valor de aquisição
  vidaUtilMeses: number;
  status: ImobBemStatus;
  fornecedorNome?: string | null;
  numeroDocumentoAquisicao?: string | null;
  numeroSerie?: string | null;
  observacao?: string | null;
  criadoEm: string; atualizadoEm: string;
}

export interface SalvarImobBem {
  plaqueta: string; descricao: string;
  categoriaId: number; localId: number; responsavelId?: number | null;
  dataAquisicao?: string | null; valorAquisicao?: number | null;
  valorResidual?: number; vidaUtilMeses?: number;
  fornecedorNome?: string; numeroDocumentoAquisicao?: string; numeroSerie?: string; observacao?: string;
}

export interface ImobBemFiltro {
  busca?: string; localId?: number; incluirSublocais?: boolean; categoriaId?: number;
  responsavelId?: number; status?: ImobBemStatus; dadosCompletos?: boolean; page?: number; pageSize?: number;
}
```

## 10. Fora desta fatia

Importação em massa por CSV (1.6), fotos, campos customizados, impressão de etiquetas e mudança de status (OS/inventário). A depreciação em si (Fase 4) só usa os campos de aquisição/residual/vida útil gravados aqui e **precisa de validação contábil** antes de uso real.
