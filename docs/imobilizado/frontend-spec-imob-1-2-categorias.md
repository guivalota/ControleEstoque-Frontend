# Spec de Frontend — Imobilizado: Categorias de bem (Fase 1.2)

> Backend na branch `tbrt-imobilizado` (migration `0014_imob_categorias`).
> Pré-requisito: `frontend-spec-imob-0b-empresas.md` (empresa ativa e header `X-Empresa-Id`).

---

## Visão geral

Categoria de bem agrupa bens com os mesmos **parâmetros de depreciação** (vida útil, valor residual, método). Cada empresa tem as suas; nada é compartilhado entre empresas nem com as categorias do Estoque.

- **Todos** os endpoints exigem `X-Empresa-Id` (o interceptor da spec 0B já envia).
- Roles: leitura (`GET`) — `admin`, `operador`, `leitura`; criar/editar — `admin`, `operador`; excluir — `admin`.
- Categoria de outra empresa é indistinguível de inexistente: `GET` → `404`; `PUT`/`DELETE` → `400` "não encontrada".
- Estas regras serão herdadas pelos bens (Fase 1.4): o bem sugere vida útil e residual da categoria. A depreciação real só é calculada na Fase 4 e **precisa de validação contábil** antes de uso real.

---

## 1. Listar — `GET /v1/imobilizado/categorias`

| Query | Tipo | Descrição |
|---|---|---|
| `busca` | `string` | Contém, sem diferenciar maiúsculas, em `nome` (`%` e `_` são literais) |
| `ativo` | `bool` | Filtra por situação |
| `page` | `number` | Padrão 1 |
| `pageSize` | `number` | Padrão 50, **máximo 100** (valores maiores são reduzidos) |

```json
{
  "items": [
    {
      "id": 1, "nome": "Móveis e utensílios", "vidaUtilMeses": 120,
      "valorResidualPercentual": 10.00, "metodoDepreciacao": "linear",
      "ativo": true, "criadoEm": "2026-10-22T14:03:11Z"
    }
  ],
  "page": 1, "pageSize": 50, "total": 1
}
```

Ordenado por nome. Para selects de formulário, use `ativo=true&pageSize=100`.

## 2. Detalhe — `GET /v1/imobilizado/categorias/{id}`

`200` com o item ou `404` `{ "error": "Categoria com id X não encontrada." }`.

## 3. Criar — `POST /v1/imobilizado/categorias`

```json
{ "nome": "Veículos", "vidaUtilMeses": 60, "valorResidualPercentual": 20, "metodoDepreciacao": "linear" }
```

| Campo | Regra |
|---|---|
| `nome` | Obrigatório, máx. 255; espaços nas pontas removidos; **único na empresa** sem diferenciar maiúsculas |
| `vidaUtilMeses` | Inteiro de **1 a 1200** |
| `valorResidualPercentual` | Número de **0 a 100** (até 2 casas decimais) — % do valor de aquisição que sobra ao fim da vida útil |
| `metodoDepreciacao` | Opcional; hoje só `"linear"` (padrão). Outros valores → `400` |

`201` + item criado (`Location` aponta para o detalhe). Erros `400` `{ "error": "..." }`: nome duplicado, vida útil/residual fora do intervalo, método não suportado, nome vazio.

> Atenção: erros de validação de formato (ex.: `vidaUtilMeses` 0) podem vir no formato padrão do ASP.NET (`errors` por campo) ou como `{ "error": "..." }` das regras de negócio; trate os dois, como nas demais telas.

## 4. Editar — `PUT /v1/imobilizado/categorias/{id}`

Mesmo corpo do criar mais `"ativo": true|false` (o corpo é sempre completo).

- Desativar não apaga nem altera bens existentes; o front deve apenas deixar de oferecê-la em novos cadastros (`ativo=true` nos selects).
- Alterar vida útil/residual **não** recalcula nada retroativamente nesta fase.

## 5. Excluir — `DELETE /v1/imobilizado/categorias/{id}`

**Role:** `admin`. Exclusão lógica (`204`). O nome de uma categoria excluída pode ser reutilizado.

> **Atualizado na Fase 1.4:** excluir uma categoria que ainda tenha bens retorna `400` "Não é possível excluir uma categoria que possui bens." Prefira "Desativar" no uso cotidiano. Ver `frontend-spec-imob-1-4-bens.md`.

---

## 6. Sugestão de UI

```
┌─ Categorias de bem ────────────────────  [+ Nova categoria] ┐
│ Buscar: [__________]   [x] Somente ativas                    │
├──────────────────────────────────────────────────────────────┤
│ Nome                   Vida útil     Residual   Método  Ações│
│ Móveis e utensílios    120m (10a)    10%        linear  ✎ 🗑 │
│ Veículos                60m (5a)     20%        linear  ✎ 🗑 │
└──────────────────────────────────────────────────────────────┘
```

- Mostrar a vida útil em meses e em anos (ex.: `120 meses (10 anos)`); enviar sempre meses.
- Campo residual com máscara de percentual (0–100); método como select com a única opção `Linear` (já preparado para novos métodos).
- Botões de criar/editar ocultos para `leitura`; excluir só para `admin`. Em `400`, mostrar `error` no formulário.

## 7. Tipos TypeScript

```typescript
export interface ImobCategoria {
  id: number;
  nome: string;
  vidaUtilMeses: number;
  valorResidualPercentual: number;
  metodoDepreciacao: 'linear';
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobCategoria {
  nome: string;
  vidaUtilMeses: number;
  valorResidualPercentual: number;
  metodoDepreciacao?: 'linear';
}
export interface AtualizarImobCategoria extends CriarImobCategoria { ativo: boolean; }

export interface ImobCategoriaFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }
```

## 8. Fora desta fatia

Taxas fiscais por categoria, importação por CSV e vínculo com bens (Fase 1.4).
