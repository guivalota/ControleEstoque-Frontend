# Spec de Frontend — Imobilizado: Locais em árvore (Fase 1.1)

> Backend na branch `tbrt-imobilizado` (migration `0013_imob_locais`).
> Pré-requisito: `frontend-spec-imob-0b-empresas.md` (empresa ativa e header `X-Empresa-Id`).

---

## Visão geral

Locais representam onde os bens ficam (filial → prédio → andar → sala…), em **árvore de profundidade livre** e **isolada por empresa**: cada empresa tem seus próprios locais, e um local nunca referencia outro de empresa diferente.

- **Todos** os endpoints abaixo exigem o header `X-Empresa-Id` (o interceptor da spec 0B já cuida disso).
- Roles: leitura (`GET`) — `admin`, `operador`, `leitura`; criar/editar — `admin`, `operador`; excluir — `admin`.
- Um local de outra empresa é indistinguível de um inexistente: `GET` → `404`; `PUT`/`DELETE` → `400` com "não encontrado".

---

## 1. Árvore completa — `GET /v1/imobilizado/locais/arvore`

Retorna todos os locais não excluídos da empresa, já aninhados (irmãos ordenados por nome). Use para o painel em árvore e para o seletor hierárquico de local. Não é paginado.

```json
[
  {
    "id": 1, "nome": "Matriz", "codigo": "MTZ", "localPaiId": null, "ativo": true,
    "filhos": [
      {
        "id": 3, "nome": "Andar 1", "codigo": null, "localPaiId": 1, "ativo": true,
        "filhos": [
          { "id": 4, "nome": "Sala 101", "codigo": "S101", "localPaiId": 3, "ativo": true, "filhos": [] }
        ]
      }
    ]
  }
]
```

## 2. Listagem plana paginada — `GET /v1/imobilizado/locais`

| Query | Tipo | Descrição |
|---|---|---|
| `busca` | `string` | Contém, sem diferenciar maiúsculas, em `nome` ou `codigo` (`%` e `_` são literais) |
| `localPaiId` | `number` | Somente filhos diretos deste local |
| `apenasRaiz` | `bool` | Somente raízes (tem precedência sobre `localPaiId`) |
| `ativo` | `bool` | Filtra por situação |
| `page` | `number` | Padrão 1 |
| `pageSize` | `number` | Padrão 50, **máximo 100** (valores maiores são reduzidos) |

```json
{ "items": [ { "id": 1, "nome": "Matriz", "codigo": "MTZ", "localPaiId": null, "ativo": true, "criadoEm": "2026-10-22T14:03:11Z" } ],
  "page": 1, "pageSize": 50, "total": 1 }
```

Use a listagem plana para busca, tabelas e carregamento sob demanda dos filhos (`localPaiId`); use a árvore para visão geral.

## 3. Detalhe — `GET /v1/imobilizado/locais/{id}`

`200` com o item (mesmo formato da listagem) ou `404` `{ "error": "Local com id X não encontrado." }`.

## 4. Criar — `POST /v1/imobilizado/locais`

```json
{ "nome": "Sala 101", "codigo": "S101", "localPaiId": 3 }
```

- `nome` obrigatório (máx. 255, espaços nas pontas são removidos); `codigo` opcional (máx. 50; vazio vira `null`); `localPaiId` opcional (omitido/`null` = raiz).
- `201` + item criado (`Location` aponta para o `GET` do detalhe).
- Erros `400` `{ "error": "..." }`:
  - código já usado por outro local da empresa;
  - **nome repetido entre irmãos** (mesmo pai; sem diferenciar maiúsculas) — o mesmo nome pode existir em pais diferentes;
  - pai inexistente ou de outra empresa.

## 5. Editar / mover — `PUT /v1/imobilizado/locais/{id}`

```json
{ "nome": "Sala 101", "codigo": "S101", "localPaiId": 5, "ativo": true }
```

Mover = trocar `localPaiId` (`null` leva para a raiz). O corpo é sempre completo (inclui `ativo`).

Erros `400` específicos de árvore:

| Mensagem | Quando |
|---|---|
| "Um local não pode ser pai de si mesmo." | `localPaiId == id` |
| "A alteração criaria um ciclo na hierarquia de locais." | O novo pai é descendente do próprio local (ex.: mover "Matriz" para dentro de "Sala 101") |
| "Local pai com id X não encontrado." | Pai inexistente/excluído/de outra empresa |
| "Local com id X não encontrado." | O próprio local não existe nesta empresa |

**Dica de UX:** no seletor "Local pai" do formulário de edição, oculte o próprio local e toda a sua subárvore (a árvore já traz `filhos`); o servidor valida de qualquer forma.

Desativar (`ativo: false`) não afeta os sublocais nem exclui nada — o front decide se oculta inativos (`ativo=true` na listagem).

## 6. Excluir — `DELETE /v1/imobilizado/locais/{id}`

**Role:** `admin`. Exclusão lógica (`204`). Se houver sublocais não excluídos → `400` "Não é possível excluir um local que possui sublocais." (exclua ou mova os filhos antes). O código de um local excluído pode ser reutilizado.

> **Atualizado na Fase 1.4:** excluir um local que ainda tenha bens (não excluídos) retorna `400` "Não é possível excluir um local que possui bens." Ver `frontend-spec-imob-1-4-bens.md`.

---

## 7. Sugestão de UI

```
┌─ Locais ─────────────────────────────  [+ Novo local] ┐
│ Buscar: [____________]  [x] Mostrar inativos           │
├────────────────────────────────────────────────────────┤
│ ▾ Matriz (MTZ)                              [✎] [🗑]   │
│   ▾ Andar 1                                 [✎] [🗑]   │
│       Sala 101 (S101)                       [✎] [🗑]   │
│   ▸ Andar 2                                 [✎] [🗑]   │
│ ▸ Filial Norte (FN)                         [✎] [🗑]   │
└────────────────────────────────────────────────────────┘
```

- Árvore expansível com ação "adicionar sublocal" (pré-preenche `localPaiId`).
- Arrastar-e-soltar para mover é opcional; use o `PUT` e trate o erro de ciclo exibindo `error`.
- Botões de criar/editar ocultos para `leitura`; excluir só para `admin`.
- Em erro `400`, mostrar `error` no formulário (campo nome/código quando a mensagem os citar).

## 8. Tipos TypeScript

```typescript
export interface ImobLocal {
  id: number;
  nome: string;
  codigo?: string | null;
  localPaiId?: number | null;
  ativo: boolean;
  criadoEm: string;
}

export interface ImobLocalArvore {
  id: number;
  nome: string;
  codigo?: string | null;
  localPaiId?: number | null;
  ativo: boolean;
  filhos: ImobLocalArvore[];
}

export interface CriarImobLocal { nome: string; codigo?: string; localPaiId?: number | null; }
export interface AtualizarImobLocal extends CriarImobLocal { ativo: boolean; }

export interface ImobLocalFiltro {
  busca?: string; localPaiId?: number; apenasRaiz?: boolean; ativo?: boolean;
  page?: number; pageSize?: number;
}
```

## 9. Fora desta fatia

Caminho textual completo ("Matriz > Andar 1 > Sala 101") no response, importação de locais por CSV e vínculo com bens (Fase 1.4).
