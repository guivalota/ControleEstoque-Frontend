# Spec de Frontend — Imobilizado: Conciliação do inventário (Fase 2.3)

> Backend na branch `tbrt-imobilizado` (migration `0021_imob_conciliacao`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (header `X-Empresa-Id`), `2-1-inventarios` e `2-2-leituras`.
> Esta fatia é **somente leitura**: mostra o resultado da comparação *esperado × lido*. Ações sobre as divergências (ajustar local, escolher o local válido de um duplicado) são a fatia 2.4; encerrar o inventário e o relatório são a 2.5.

---

## Visão geral

A conciliação responde, para cada plaqueta: **o que o sistema esperava encontrar** (o snapshot congelado ao iniciar o inventário) **versus o que foi lido** (leituras ativas, não anuladas).

- **Sempre atualizada:** é recalculada a cada consulta. Registrar ou anular uma leitura aparece na próxima chamada — não existe botão "recalcular" nem dado defasado. Para um painel ao vivo basta repetir a consulta (ex.: a cada 30–60 s).
- Disponível para inventários **iniciados** (`em_andamento`, `concluido` e `cancelado`). Em `rascunho` → `400` (ainda não há esperado nem leituras).
- Roles: `admin`, `operador`, `leitura`. Exige `X-Empresa-Id`. Inventário de outra empresa é indistinguível de inexistente (`404`).
- Desempenho medido: com 10.000 bens esperados e 10.000 leituras, o resumo e uma página filtrada respondem em dezenas de milissegundos no banco.

Base: `/v1/imobilizado/inventarios/{inventarioId}/conciliacao`.

### As cinco situações

| `situacao` | Quando | Exemplo | Cor sugerida |
|---|---|---|---|
| `encontrado` | Está no esperado e todas as leituras ativas foram **no local esperado** | Esperado na Matriz, lido na Matriz | verde |
| `local_divergente` | Está no esperado e foi lida **em um único local, diferente do esperado** | Esperado na Sala 101, lido na Matriz | amarelo |
| `nao_encontrado` | Está no esperado e **não tem nenhuma leitura ativa** | Esperado na Matriz, ninguém leu | vermelho |
| `sobra` | Foi lida mas **não estava no esperado** | Bem de outro local/escopo, bem baixado ou plaqueta que nem existe | laranja |
| `duplicado` | Foi lida em **mais de um local distinto** (contradição) | Lida na Matriz e na Filial | roxo |

Detalhes que importam para a tela:

- **"Local esperado" é exato.** Um bem esperado na *Sala 101* e lido no local pai *Matriz* é `local_divergente` (o escopo inclui sublocais, mas a comparação é pelo local específico).
- **Leituras repetidas não são problema.** A mesma plaqueta lida várias vezes **no mesmo local** continua `encontrado` (ou `local_divergente`); apenas `qtdLeituras > 1` / `leiturasRepetidas: true` — mostre um ícone discreto de aviso, sem exigir ação.
- **`duplicado` é contradição:** o mesmo código visto em locais diferentes. Nesta fatia só se mostra (`locaisLidos` traz todos); na 2.4 o `admin` escolherá qual vale.
- **Sobra pode ter ou não cadastro:** `bemId != null` = o bem existe (mostre `descricao`; o `localEsperadoId` vem nulo por não estar no esperado); `bemId == null` = **plaqueta desconhecida** (não existe bem com esse código na empresa — etiqueta errada, bem não cadastrado, erro de digitação).
- **Sem diferenciar maiúsculas/minúsculas:** `nb-1` lido casa com `NB-1`; a `plaqueta` exibida é a do cadastro/snapshot quando esperado.
- **O esperado não muda** depois de iniciado: bens movidos, editados ou cadastrados depois do início não alteram o que era esperado (um bem cadastrado depois e lido aparece como `sobra`; um bem excluído depois continua esperado).
- Leituras **anuladas** não contam.

---

## 1. Resumo — `GET .../conciliacao/resumo`

Ideal para o cabeçalho/painel do inventário.

```json
{
  "inventarioId": 7, "statusInventario": "em_andamento",
  "esperados": 155, "esperadosLidos": 140, "percentualLido": 90.32,
  "encontrados": 130, "localDivergente": 8, "naoEncontrados": 15, "sobras": 4, "duplicados": 2,
  "plaquetasComLeiturasRepetidas": 11, "leiturasAtivas": 162, "leiturasAnuladas": 3
}
```

| Campo | Significado |
|---|---|
| `esperados` | Bens no snapshot |
| `esperadosLidos` | Esperados com ao menos uma leitura (`encontrados + localDivergente + duplicados que eram esperados`) |
| `percentualLido` | `esperadosLidos / esperados × 100`, 2 casas (0 se não há esperados) — o **progresso da contagem** |
| `encontrados` / `localDivergente` / `naoEncontrados` / `sobras` / `duplicados` | Contagem por situação (soma = total de linhas da conciliação) |
| `plaquetasComLeiturasRepetidas` | Plaquetas com mais de uma leitura ativa |
| `leiturasAtivas` / `leiturasAnuladas` | Totais de leituras |

`esperados` não é a soma das situações: `sobras` (e `duplicados` de plaquetas desconhecidas) não pertencem ao esperado.

## 2. Listar — `GET .../conciliacao`

| Query | Tipo | Descrição |
|---|---|---|
| `situacao` | `string` | Uma das cinco situações (outro valor → `400`) |
| `apenasDivergencias` | `bool` | Atalho: tudo que **não** é `encontrado` |
| `localId` | `number` | Plaquetas cujo **local esperado** é este **ou** que foram **lidas** neste local |
| `busca` | `string` | Contém, sem diferenciar maiúsculas, na plaqueta ou na descrição (`%` e `_` são literais) |
| `page` / `pageSize` | `number` | Padrão 1 / 50; **máximo 100** |

Ordenado por plaqueta. Resposta paginada `{ items, page, pageSize, total }`:

```json
{
  "itemId": 8812, "bemId": 42, "plaqueta": "NB-0001", "descricao": "Notebook Dell Latitude",
  "situacao": "local_divergente",
  "localEsperadoId": 7, "localEsperadoNome": "Sala 101",
  "localLidoId": 3, "localLidoNome": "Matriz",
  "locaisLidos": [ { "localId": 3, "localNome": "Matriz" } ],
  "qtdLeituras": 1, "leiturasRepetidas": false,
  "primeiraLeituraEm": "2026-10-22T14:30:00Z", "ultimaLeituraEm": "2026-10-22T14:30:00Z"
}
```

| Campo | Notas |
|---|---|
| `itemId` | Linha do esperado; **nulo nas sobras** (e nos duplicados de plaqueta desconhecida) |
| `bemId` | Nulo = plaqueta desconhecida |
| `localEsperadoId/Nome` | Nulos nas sobras |
| `localLidoId/Nome` | Preenchidos só quando as leituras foram em **um único local**; nulos em `nao_encontrado` e em `duplicado` |
| `locaisLidos` | Todos os locais distintos lidos (vazio em `nao_encontrado`) |

## 3. Sugestão de UI

**Painel do inventário (cards + progresso):**

```
┌─ Inventário anual 2026 · Em andamento ────────────────────────────┐
│ Progresso  ████████████████░░  90,32%   (140 de 155 lidos)         │
│ ✔ Encontrados 130   ⚠ Local divergente 8   ✖ Não encontrados 15    │
│ ＋ Sobras 4          ⇄ Duplicados 2         ⟳ Leituras repetidas 11 │
└───────────────────────────────────────────────────────────────────┘
```

- Cada card filtra a tabela abaixo (`?situacao=`), com abas/contadores vindos do resumo.
- Tabela: plaqueta, descrição, esperado em, lido em, leituras, situação (com a cor da tabela acima). Em `duplicado`, mostre os locais lidos como chips. Em `sobra` sem bem, rotule "plaqueta desconhecida".
- Filtro por local (árvore) e busca por plaqueta/descrição; botão "só divergências".
- Ações (ajustar local, escolher o local válido) aparecem na fatia 2.4; por ora deixe o espaço da coluna "Ações".
- Atualização: botão "atualizar" e/ou polling de 30–60 s do `resumo`.

## 4. Tipos TypeScript

```typescript
export type SituacaoConciliacao = 'encontrado' | 'local_divergente' | 'nao_encontrado' | 'sobra' | 'duplicado';

export interface ConciliacaoItem {
  itemId?: number | null; bemId?: number | null; plaqueta: string; descricao?: string | null;
  situacao: SituacaoConciliacao;
  localEsperadoId?: number | null; localEsperadoNome?: string | null;
  localLidoId?: number | null; localLidoNome?: string | null;
  locaisLidos: { localId: number; localNome: string }[];
  qtdLeituras: number; leiturasRepetidas: boolean;
  primeiraLeituraEm?: string | null; ultimaLeituraEm?: string | null;
}

export interface ConciliacaoResumo {
  inventarioId: number; statusInventario: string;
  esperados: number; esperadosLidos: number; percentualLido: number;
  encontrados: number; localDivergente: number; naoEncontrados: number; sobras: number; duplicados: number;
  plaquetasComLeiturasRepetidas: number; leiturasAtivas: number; leiturasAnuladas: number;
}

export interface ConciliacaoFiltro {
  situacao?: SituacaoConciliacao; apenasDivergencias?: boolean; localId?: number; busca?: string;
  page?: number; pageSize?: number;
}
```

## 5. Fora desta fatia

Tratar divergências — ajustar o local do bem para onde foi lido, escolher o local válido de um `duplicado`, marcar como resolvido (2.4); painel por local e por membro da equipe (2.4); encerramento do inventário, congelamento do resultado e relatório PDF/CSV (2.5); sincronização incremental com cursor para o app (2.6).
