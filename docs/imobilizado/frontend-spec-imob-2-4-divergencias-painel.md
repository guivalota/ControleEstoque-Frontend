# Spec de Frontend — Imobilizado: Divergências e painel do inventário (Fase 2.4)

> Backend na branch `tbrt-imobilizado` (migration `0022_imob_resolucoes`).
> Pré-requisitos: `0b-empresas` (header `X-Empresa-Id`), `2-1-inventarios`, `2-2-leituras` e `2-3-conciliacao`.
> Esta fatia adiciona o **tratamento das divergências** (decidir o que fazer com cada uma) e o **painel** de acompanhamento (por local e por membro da equipe). Encerrar o inventário e o relatório são a 2.5.

---

## Visão geral

A conciliação (2.3) continua sendo recalculada a cada consulta. Aqui ficam guardadas só as **decisões humanas** sobre cada plaqueta divergente (`encontrado` nunca precisa de decisão).

Duas ações possíveis:

| `acao` | O que faz |
|---|---|
| `ajustar_local` | Move o bem no cadastro para o local escolhido, **com histórico do bem** (campo `local_id`). Registra a resolução. |
| `manter` | Só reconhece a divergência, sem alterar o cadastro (observação opcional). Serve para "não encontrado" (o extravio é tratado pelas OS da Fase 3), "sobra" e "local divergente" aceito. |

Regras:

- Só com inventário **`em_andamento`** (senão `400`). Depois de encerrado/cancelado as decisões ficam congeladas.
- **Quem pode:** `admin` e `operador` (role `leitura` → `403`). Plaqueta `duplicado` (lida em locais diferentes) **só `admin`**; operador recebe `403` com mensagem.
- `ajustar_local`: o bem precisa estar cadastrado (`bemId != null`; plaqueta desconhecida → `400`), não pode ser `nao_encontrado` (não há local lido) nem estar `baixado`/`vendido`; o local de destino precisa ser **um dos locais em que a plaqueta foi lida** e estar ativo. Se `localDestinoId` for omitido, usa o local lido; em `duplicado` ele é **obrigatório** (o admin escolhe qual local vale).
- `manter` não aceita `localDestinoId`.
- `observacao`: até 2000 caracteres.
- Uma plaqueta já resolvida (`resolvida: true`) não pode ser decidida de novo: **reabra** antes — e só resoluções `manter` podem ser reabertas (`ajustar_local` já moveu o bem; corrija o bem manualmente se preciso).
- **Resolução desatualizada:** se depois da decisão chegar leitura que muda a situação (ex.: foi lida em um segundo local e virou `duplicado`), a decisão deixa de valer: `resolvida: false`, `resolucaoDesatualizada: true`, a divergência volta para os pendentes e pode ser decidida de novo (a nova decisão substitui a antiga automaticamente).
- Plaqueta é casada sem diferenciar maiúsculas/minúsculas.

Base: `/v1/imobilizado/inventarios/{inventarioId}/conciliacao`. Todos os endpoints exigem `X-Empresa-Id`; inventário de outra empresa é indistinguível de inexistente (`404`).

---

## 1. Campos novos na listagem e no resumo

`GET .../conciliacao` — cada item ganha:

```json
{
  "plaqueta": "D1", "situacao": "local_divergente", "...": "...",
  "resolvida": true,
  "resolucaoDesatualizada": false,
  "resolucao": {
    "acao": "ajustar_local", "localDestinoId": 4, "localDestinoNome": "Matriz",
    "observacao": "ok", "resolvidoPorId": "…", "resolvidoPorNome": "Ana", "resolvidoEm": "2026-10-22T14:03:00Z"
  }
}
```

- `resolucao` é `null` quando nunca houve decisão; vem preenchida também quando está desatualizada (mostre "decisão anterior: …" com aviso).
- Novo filtro `?resolucao=pendentes|resolvidas`. **Pendentes** = divergência (situação ≠ `encontrado`) sem decisão válida — é a fila de trabalho. Combina com `situacao`, `localId`, `busca`, `apenasDivergencias`.
- `GET .../conciliacao/resumo` ganha `divergenciasPendentes`, `divergenciasResolvidas` e `resolucoesDesatualizadas`.

Sugestão de UI: aba/chip "Pendentes (N)" como padrão da tela de conciliação; badge "decisão desatualizada" quando `resolucaoDesatualizada`.

---

## 2. Resolver — `POST .../conciliacao/resolver`

Roles: `admin`, `operador`.

```json
{ "plaqueta": "D1", "acao": "ajustar_local", "localDestinoId": 4, "observacao": "Bem estava na recepção" }
```

| Campo | Obrigatório | Observação |
|---|---|---|
| `plaqueta` | sim | Como aparece na conciliação |
| `acao` | sim | `ajustar_local` ou `manter` |
| `localDestinoId` | só `duplicado` + `ajustar_local` | Omitido = local lido |
| `observacao` | não | ≤ 2000 |

Resposta `200`: o item da conciliação já atualizado (mesmo formato da listagem, com `resolvida: true` e `resolucao`).

Erros: `400` (`{ "error": "…" }`) regra violada — mensagens em português prontas para exibir; `403` duplicado por operador / role `leitura`; `404` inventário inexistente.

## 3. Reabrir — `POST .../conciliacao/reabrir`

Roles: `admin`, `operador` (duplicado só `admin`).

```json
{ "plaqueta": "D3" }
```

`200` com o item atualizado (volta a `resolvida: false`). `400` se não há resolução, se for `ajustar_local` ou se o inventário não está em andamento.

---

## 4. Painel — `GET /v1/imobilizado/inventarios/{inventarioId}/painel`

Todos os papéis. Rascunho → `400`; inexistente → `404`. Recalculado a cada chamada (pode repetir a cada 30–60 s).

```json
{
  "resumo": { "...": "mesmo formato do /conciliacao/resumo" },
  "locais": [
    { "localId": 1, "localNome": "Matriz", "localPaiId": null,
      "esperados": 120, "lidos": 100, "percentualLido": 83.33,
      "encontrados": 95, "localDivergente": 3, "naoEncontrados": 20, "duplicados": 2,
      "sobrasLidas": 4, "divergenciasPendentes": 26 }
  ],
  "equipe": [
    { "usuarioId": "…", "nome": "Ana", "naEquipe": true, "leituras": 80, "plaquetasDistintas": 76,
      "primeiraLeituraEm": "…", "ultimaLeituraEm": "…" }
  ]
}
```

- **`locais`**: um item por local que tem bens esperados ou sobras lidas. Os números de "esperados/lidos/…" são pelo **local esperado** do bem; `sobrasLidas` conta plaquetas fora do esperado lidas naquele local. `divergenciasPendentes` = divergências sem decisão válida naquele local (inclui as sobras). `localPaiId` permite montar a árvore (some os sublocais se quiser agregar).
- **`equipe`**: leituras **ativas** por usuário (anuladas não contam). Membro da equipe que ainda não leu vem com `leituras: 0`; quem leu sem estar na equipe (ex.: um `admin`) vem com `naEquipe: false`. Ordenado por mais leituras.

Sugestão de UI: topo com barra de progresso (`resumo.percentualLido`) e contadores; tabela de locais com barra por local e destaque para pendentes; lista da equipe com última atividade.

---

## Checklist de implementação

- [ ] Filtro "Pendentes / Resolvidas" na tela de conciliação, com contadores do resumo.
- [ ] Modal de decisão: ação (`ajustar_local`/`manter`), seletor de local (apenas `locaisLidos`; obrigatório em duplicado), observação.
- [ ] Ocultar "decidir duplicado" para quem não é `admin` (o backend responde `403` de qualquer forma).
- [ ] Ação "Reabrir" só para resoluções `manter`.
- [ ] Badge para `resolucaoDesatualizada`.
- [ ] Desabilitar tudo isso fora de `em_andamento`.
- [ ] Tela de painel (locais + equipe) com atualização periódica.
