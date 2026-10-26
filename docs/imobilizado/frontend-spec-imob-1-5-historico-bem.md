# Spec de Frontend — Imobilizado: Histórico de alterações do bem (Fase 1.5)

> Backend na branch `tbrt-imobilizado` (sem migration nova: a gravação já existe desde a `0016_imob_bens`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (header `X-Empresa-Id`) e `frontend-spec-imob-1-4-bens.md`.

---

## Visão geral

Todo bem tem uma **trilha de alterações** gravada automaticamente no servidor, na mesma transação da mudança: criação, cada campo alterado na edição e exclusão, sempre com o usuário autenticado e a data/hora. A trilha é **somente leitura** (não há como editá-la ou apagá-la pela API).

- Exige `X-Empresa-Id`. Roles: `admin`, `operador`, `leitura`.
- Bem de outra empresa, inexistente ou **excluído** → `404` (o histórico de um bem excluído não é exposto por esta API).

---

## 1. Consultar — `GET /v1/imobilizado/bens/{id}/historico`

| Query | Tipo | Descrição |
|---|---|---|
| `page` | `number` | Padrão 1 |
| `pageSize` | `number` | Padrão 50, **máximo 100** (valores maiores são reduzidos) |

Ordenado do **mais recente para o mais antigo**. Resposta paginada `{ items, page, pageSize, total }`:

```json
{
  "items": [
    {
      "id": 31, "campo": "local_id",
      "valorAnterior": "7", "valorNovo": "9",
      "valorAnteriorDescricao": "Sala 101", "valorNovoDescricao": "Almoxarifado",
      "usuarioId": "3f2b9a52-…", "usuarioNome": "Maria Operadora",
      "criadoEm": "2026-10-22T14:03:11Z"
    },
    {
      "id": 30, "campo": "descricao",
      "valorAnterior": "Notebook Dell", "valorNovo": "Notebook Dell Latitude 5440",
      "valorAnteriorDescricao": null, "valorNovoDescricao": null,
      "usuarioId": "3f2b9a52-…", "usuarioNome": "Maria Operadora",
      "criadoEm": "2026-10-22T14:03:11Z"
    },
    {
      "id": 12, "campo": "criacao", "valorAnterior": null, "valorNovo": "NB-0001",
      "valorAnteriorDescricao": null, "valorNovoDescricao": null,
      "usuarioId": "3f2b9a52-…", "usuarioNome": "João Admin", "criadoEm": "2026-10-20T09:15:40Z"
    }
  ],
  "page": 1, "pageSize": 50, "total": 3
}
```

Uma edição que altera vários campos gera **várias entradas** (uma por campo) com o mesmo `criadoEm`; agrupe por usuário + instante na UI se quiser mostrar "Maria alterou 3 campos". Salvar sem mudar nada **não** gera entradas.

### Campos (`campo`)

| `campo` | Significado | `valorAnterior` / `valorNovo` |
|---|---|---|
| `criacao` | Bem cadastrado | anterior `null`; novo = plaqueta |
| `exclusao` | Bem excluído | anterior = plaqueta; novo `null` (não aparece nesta API, pois o bem some) |
| `plaqueta`, `descricao`, `fornecedor_nome`, `numero_documento_aquisicao`, `numero_serie`, `observacao` | Texto | o texto (ou `null`) |
| `categoria_id`, `local_id`, `responsavel_id` | Referência | **id** em texto; o nome vem em `valorAnteriorDescricao` / `valorNovoDescricao` |
| `data_aquisicao` | Data | `yyyy-MM-dd` |
| `valor_aquisicao`, `valor_residual` | Valor | decimal com ponto (ex.: `"1500.00"`) |
| `vida_util_meses` | Inteiro | em texto |

Notas:
- Para `categoria_id`/`local_id`/`responsavel_id`, a `...Descricao` é o **nome atual** do cadastro, mesmo que ele tenha sido excluído depois. `responsavel_id` anterior `null` = "sem responsável" (`valorAnteriorDescricao` também `null`).
- Alterações de **status** ainda não existem (virão com OS/inventário nas Fases 2–3 e entrarão nesta mesma trilha).
- `usuarioNome` pode vir `null` se o usuário não existir mais no cadastro de usuários; exiba o `usuarioId` abreviado como fallback.

---

## 2. Sugestão de UI

Aba "Histórico" no detalhe do bem, em linha do tempo:

```
┌─ Histórico — NB-0001 ───────────────────────────────────┐
│ 22/10/2026 14:03  Maria Operadora                        │
│   Local:       Sala 101  →  Almoxarifado                 │
│   Descrição:   Notebook Dell → Notebook Dell Latitude…   │
│ 20/10/2026 09:15  João Admin                             │
│   Bem cadastrado (plaqueta NB-0001)                      │
│                                      [Carregar mais ▾]   │
└──────────────────────────────────────────────────────────┘
```

- Rótulos amigáveis: `local_id` → "Local", `categoria_id` → "Categoria", `responsavel_id` → "Responsável", `valor_aquisicao` → "Valor de aquisição", `vida_util_meses` → "Vida útil (meses)", `numero_serie` → "Nº de série", etc.
- Para campos de referência, mostrar `...Descricao` (com fallback para "#id"); valores monetários em BRL; datas em `dd/MM/yyyy`; `null` como "—".
- Paginação por "carregar mais" (`page` crescente) — a lista pode crescer.
- Transferências de local/responsável feitas pela edição do cadastro aparecem aqui como correções; as transferências formais por OS (Fase 3) aparecerão com o mesmo formato.

## 3. Tipos TypeScript

```typescript
export interface ImobBemHistorico {
  id: number;
  campo: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  valorAnteriorDescricao?: string | null;
  valorNovoDescricao?: string | null;
  usuarioId: string;
  usuarioNome?: string | null;
  criadoEm: string;
}
```

## 4. Fora desta fatia

Filtros por campo/usuário/período, histórico de bens excluídos, e exportação da trilha (auditoria do módulo).

---

## Atualização (Fase 3): histórico gerado por OS

A partir da Fase 3, `ImobBemHistoricoResponse` ganha `osId` e `osNumero` (nulos para edição direta, criação, exclusão e ajustes de inventário) e um novo valor de `campo`: **`status`** (`ativo`, `em_manutencao`, `baixado`, `vendido`, `extraviado`), além de `local_id`/`responsavel_id` quando a mudança vem de uma transferência. Detalhes em `frontend-spec-imob-3-2-aprovacao-os.md`.
