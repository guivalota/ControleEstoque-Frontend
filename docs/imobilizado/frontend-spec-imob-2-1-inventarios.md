# Spec de Frontend — Imobilizado: Inventários (Fase 2.1 — cabeçalho, escopo, equipe e início)

> Backend na branch `tbrt-imobilizado` (migration `0019_imob_inventarios`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (header `X-Empresa-Id`), locais (1.1) e bens (1.4).
> Esta fatia **só cria e gerencia o inventário e congela o "esperado"**. Registrar leituras, conciliar e encerrar vêm nas fatias 2.2–2.5 (esta spec será complementada).

---

## Visão geral

Um **inventário** é uma contagem física dos bens de uma empresa em um conjunto de locais. Ele tem:

- **Escopo:** os locais a contar. Escolher um local inclui **todos os seus sublocais** automaticamente.
- **Equipe:** os usuários que farão a contagem (opcional nesta fatia).
- **Esperado (snapshot):** ao **iniciar**, o servidor congela a lista de bens que o sistema diz existir no escopo naquele instante (bens `ativo` ou `em_manutencao`, não excluídos). Mover ou editar bens durante a contagem **não altera** o esperado — é com ele que as leituras serão comparadas.

Roles: leitura (`GET`) — `admin`, `operador`, `leitura`; criar/editar/iniciar/cancelar — `admin`, `operador`; excluir — `admin`. Todos os endpoints exigem `X-Empresa-Id`. Inventário de outra empresa é indistinguível de inexistente (`GET` → `404`; `PUT`/ações → `400` "não encontrado").

### Status e transições

```
rascunho ──iniciar──▶ em_andamento ──(encerrar: fatia 2.5)──▶ concluido
   │                      │
   └────── cancelar ──────┴──▶ cancelado
```

| Status | Pode editar | Pode iniciar | Pode cancelar | Pode excluir |
|---|---|---|---|---|
| `rascunho` | tudo (nome, descrição, **locais**, equipe) | sim | sim | sim (`admin`) |
| `em_andamento` | nome, descrição e **equipe** (escopo congelado) | não | sim | não |
| `concluido` | não | não | não | não |
| `cancelado` | não | não | não | sim (`admin`) |

Ações fora da tabela retornam `400` com `{ "error": "..." }` explicando o status atual.

---

## 1. Listar — `GET /v1/imobilizado/inventarios`

| Query | Tipo | Descrição |
|---|---|---|
| `busca` | `string` | Contém, sem diferenciar maiúsculas, no nome (`%` e `_` são literais) |
| `status` | `string` | `rascunho`, `em_andamento`, `concluido` ou `cancelado` (outro valor → `400`) |
| `page` / `pageSize` | `number` | Padrão 1 / 50; **`pageSize` máximo 100** |

Ordenado do mais recente para o mais antigo. Itens (sem escopo/equipe):

```json
{
  "items": [
    {
      "id": 7, "nome": "Inventário anual 2026", "status": "em_andamento",
      "dataInicio": "2026-10-22T14:03:11Z", "dataFim": null,
      "criadoPorId": "3f2b…", "criadoPorNome": "Maria Operadora", "criadoEm": "2026-10-20T09:00:00Z",
      "totalLocais": 2, "totalEsperados": 155
    }
  ],
  "page": 1, "pageSize": 50, "total": 1
}
```

`totalEsperados` é 0 enquanto for rascunho (o esperado só existe depois de iniciar).

## 2. Detalhe — `GET /v1/imobilizado/inventarios/{id}`

Mesmos campos da listagem mais `descricao`, `atualizadoEm`, `locais` e `equipe`:

```json
{
  "id": 7, "nome": "Inventário anual 2026", "descricao": "Contagem geral", "status": "rascunho",
  "dataInicio": null, "dataFim": null, "criadoPorId": "3f2b…", "criadoPorNome": "Maria Operadora",
  "criadoEm": "2026-10-20T09:00:00Z", "atualizadoEm": "2026-10-20T09:00:00Z",
  "totalLocais": 2, "totalEsperados": 0,
  "locais": [ { "localId": 1, "localNome": "Matriz" }, { "localId": 9, "localNome": "Filial" } ],
  "equipe": [ { "usuarioId": "8a1c…", "nome": "Carlos Contador" } ]
}
```

`404` se não existir na empresa ativa.

## 3. Criar — `POST /v1/imobilizado/inventarios`

```json
{ "nome": "Inventário anual 2026", "descricao": "Contagem geral", "localIds": [1, 9], "usuarioIds": ["8a1c…"] }
```

| Campo | Regra |
|---|---|
| `nome` | Obrigatório, máx. 200; espaços nas pontas removidos; **único na empresa** (sem diferenciar maiúsculas) entre inventários não excluídos |
| `descricao` | Opcional, máx. 2000 |
| `localIds` | **Ao menos um** local **ativo** da empresa. Repetidos são ignorados. Sublocais entram sozinhos ao iniciar — não precisa listá-los |
| `usuarioIds` | Opcional. Cada usuário precisa ter **vínculo ativo com a empresa** (use `GET /v1/imobilizado/empresas/{id}/usuarios` no admin ou a lista de usuários da empresa) |

`201` + detalhe (`Location` aponta para o `GET`). Erros `400`: nome vazio/duplicado, sem locais, local inexistente/inativo/de outra empresa, usuário sem vínculo ativo.

## 4. Editar — `PUT /v1/imobilizado/inventarios/{id}`

Mesmo corpo do criar (sempre completo). `equipe` é **substituída** pelo que for enviado (omitir ou `[]` esvazia).

- **Rascunho:** `localIds` substitui o escopo.
- **Em andamento:** `localIds` deve ser **exatamente o escopo atual**; qualquer diferença → `400` "O escopo (locais) não pode ser alterado depois que o inventário foi iniciado". Nome, descrição e equipe podem mudar (útil para incluir alguém na contagem).
- `concluido`/`cancelado` → `400`.

## 5. Iniciar — `POST /v1/imobilizado/inventarios/{id}/iniciar`

Sem corpo. Congela o esperado e muda para `em_andamento` (`dataInicio` preenchida). Retorna `200` com o detalhe, incluindo `totalEsperados`.

- Só em rascunho. Com escopo sem bens, inicia com `totalEsperados: 0` (as leituras virarão "sobras").
- Se um local do escopo foi excluído depois do rascunho salvo → `400` pedindo para editar o escopo.
- **Ação irreversível** (exceto cancelar): peça confirmação, mostrando os locais e avisando que o esperado será congelado agora.

## 6. Cancelar — `POST /v1/imobilizado/inventarios/{id}/cancelar`

De `rascunho` ou `em_andamento` para `cancelado` (`dataFim` preenchida). Sem corpo; `200` com o detalhe. Confirmar com o usuário; o inventário cancelado fica no histórico (somente leitura).

## 7. Excluir — `DELETE /v1/imobilizado/inventarios/{id}`

**Role:** `admin`. Exclusão lógica (`204`), só para `rascunho` ou `cancelado`. O nome pode ser reutilizado depois.

---

## 8. Sugestão de UI

```
┌─ Inventários ──────────────────────────────  [+ Novo inventário] ┐
│ Buscar: [________]  Status: [Todos ▾]                             │
├───────────────────────────────────────────────────────────────────┤
│ Nome                      Status         Início      Esperados    │
│ Inventário anual 2026     ● Em andamento 22/10/2026  155          │
│ Teste de filial           ○ Rascunho     —           —            │
└───────────────────────────────────────────────────────────────────┘

Detalhe:  [Editar] [Iniciar contagem] [Cancelar] [Excluir]   (botões conforme status e papel)
  Escopo: Matriz (inclui sublocais) · Filial     Equipe: Carlos Contador
```

- Formulário: nome, descrição, seletor de locais em **árvore multi-seleção** (`GET locais/arvore`, apenas ativos; marcar um local deixa claro que os sublocais entram), seletor de equipe (usuários vinculados à empresa).
- Em `em_andamento`, desabilitar o seletor de locais (somente leitura) e manter nome/descrição/equipe editáveis.
- Mostrar o selo de status com cores distintas e, em andamento, o total esperado.
- Em `400` com `error`, exibir a mensagem.

## 9. Tipos TypeScript

```typescript
export type ImobInventarioStatus = 'rascunho' | 'em_andamento' | 'concluido' | 'cancelado';

export interface ImobInventarioResumo {
  id: number; nome: string; status: ImobInventarioStatus;
  dataInicio?: string | null; dataFim?: string | null;
  criadoPorId: string; criadoPorNome?: string | null; criadoEm: string;
  totalLocais: number; totalEsperados: number;
}

export interface ImobInventario extends ImobInventarioResumo {
  descricao?: string | null; atualizadoEm: string;
  locais: { localId: number; localNome: string }[];
  equipe: { usuarioId: string; nome?: string | null }[];
}

export interface SalvarImobInventario {
  nome: string; descricao?: string; localIds: number[]; usuarioIds?: string[];
}

export interface ImobInventarioFiltro { busca?: string; status?: ImobInventarioStatus; page?: number; pageSize?: number; }
```

## 10. O que vem nas próximas fatias

Registro de leituras (manual e por CSV, com idempotência), conciliação (encontrado / local divergente / não encontrado / sobra / duplicado), painel de progresso, tratamento de divergências, encerramento com relatório, e o contrato de sincronização para o app. Esta spec será estendida a cada fatia.
