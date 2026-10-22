# Spec de Frontend — Imobilizado: Encerramento do inventário e relatório (Fase 2.5)

> Backend na branch `tbrt-imobilizado` (migration `0023_imob_encerramento`).
> Pré-requisitos: `2-1-inventarios`, `2-2-leituras`, `2-3-conciliacao`, `2-4-divergencias-painel` e o header `X-Empresa-Id` (`0b-empresas`).

---

## Visão geral

Encerrar um inventário **congela o resultado**: a conciliação final (com as decisões tomadas sobre as divergências) é gravada e, a partir daí, o inventário `concluido` mostra sempre esse resultado — mesmo que depois bens sejam cadastrados, editados, movidos ou baixados.

- **Só `admin`** encerra (operador/leitura → `403`).
- Só inventário `em_andamento` pode ser encerrado (senão `400`).
- Depois de encerrado: leituras, anulações, decisões e reabertura de divergências são recusadas (`400`); **consulta** (conciliação, resumo, painel, relatório) continua liberada para todos os papéis.
- O encerramento **não altera o cadastro de bens** por si só (os ajustes de local já foram feitos nas decisões `ajustar_local`).
- **Pendências:** se ainda há divergências sem decisão válida, o encerramento é recusado, a não ser que o admin confirme explicitamente. A quantidade fica registrada no inventário (`pendenciasAoEncerrar`).

---

## 1. Encerrar — `POST /v1/imobilizado/inventarios/{id}/encerrar`

Role: `admin`. Exige `X-Empresa-Id`. O corpo é opcional.

```json
{ "confirmarPendencias": true }
```

| Situação | Resposta |
|---|---|
| Sem pendências | `200` com o inventário (`status: "concluido"`) |
| Com pendências e `confirmarPendencias` ausente/`false` | `400` `{ "error": "Há 12 divergência(s) pendente(s). Confirme o encerramento para prosseguir mesmo assim." }` |
| Com pendências e `confirmarPendencias: true` | `200` |
| Inventário não está `em_andamento` | `400` |
| Inventário inexistente / de outra empresa | `400` (`não encontrado`) |

Campos novos em `ImobInventarioResponse` (e na listagem):

| Campo | Significado |
|---|---|
| `encerradoPorId` / `encerradoPorNome` | Quem encerrou (nulo se não encerrado) |
| `pendenciasAoEncerrar` | Divergências sem decisão no momento do encerramento (nulo se não encerrado) |
| `dataFim` | Data do encerramento (também preenchida no cancelamento) |

Fluxo de UI sugerido: botão "Encerrar inventário" (só para `admin`, só `em_andamento`). Antes de chamar, consulte `GET .../conciliacao/resumo`: se `divergenciasPendentes > 0`, mostre um diálogo de confirmação ("Existem N divergências sem decisão. Encerrar mesmo assim?") e envie `confirmarPendencias: true` só após o aceite. Mostre também as `resolucoesDesatualizadas`, que contam como pendentes. Ação **irreversível**: avise.

---

## 2. Relatório — `GET /v1/imobilizado/inventarios/{id}/relatorio?formato=pdf|csv`

Roles: `admin`, `operador`, `leitura`. `formato` padrão = `pdf`. Rascunho → `400`; formato inválido → `400`; inventário inexistente → `404`.

- **Concluído:** resultado final (gravado no encerramento). Arquivo `inventario-{id}.pdf|csv`.
- **Em andamento / cancelado:** retrato **parcial**, calculado na hora. Arquivo `inventario-{id}-parcial.pdf|csv` e o PDF traz o selo "RESULTADO PARCIAL".

Baixe como `blob` (use o `Content-Disposition` para o nome do arquivo; o header `X-Empresa-Id` é obrigatório, então não dá para usar um `<a href>` simples — faça a requisição com o interceptor e salve o blob).

### PDF (A4 paisagem)

Cabeçalho com empresa e nome do inventário; quadro-resumo (status, datas, quem encerrou, pendências no encerramento, contagens por situação, leituras); progresso por local; equipe; tabela de divergências com a decisão tomada.

### CSV (UTF-8 com BOM — abre com acentos no Excel)

Uma linha por plaqueta da conciliação (inclusive as encontradas). Colunas:

`Plaqueta, Descricao, Situacao, LocalEsperado, LocalLido, LocaisLidos, QtdLeituras, PrimeiraLeitura, UltimaLeitura, Pendente, Decisao, LocalDestino, ObservacaoDecisao, DecididoPor, DecididoEm, DecisaoDesatualizada`

- Datas no horário de Brasília (`yyyy-MM-dd HH:mm`).
- `Pendente` = `sim` quando é divergência sem decisão válida; `Decisao` = `ajustar_local` ou `manter`.
- Valores iniciados por `=`, `+`, `-`, `@` recebem um apóstrofo na frente (proteção contra fórmula em planilha).

---

## 3. Leitura de um inventário concluído

Todos os endpoints de consulta (`/conciliacao`, `/conciliacao/resumo`, `/painel`) funcionam igual, mas sobre o **resultado gravado**. Diferenças práticas para a tela:

- Esconda/desabilite: registrar/importar/anular leitura, resolver/reabrir divergência, encerrar.
- Exiba `encerradoPorNome`, `dataFim` e o aviso "Encerrado com N pendências" quando `pendenciasAoEncerrar > 0`.
- Nomes de bem e local no resultado são os do momento do encerramento (a descrição do bem não muda no relatório se o cadastro for editado depois).

---

## Checklist de implementação

- [ ] Botão "Encerrar" (admin, `em_andamento`) com diálogo de pendências e confirmação irreversível.
- [ ] Tratar `400` com a mensagem de pendências e oferecer "Encerrar mesmo assim".
- [ ] Modo somente leitura quando `status = concluido` (e `cancelado`).
- [ ] Botões "Baixar PDF" / "Baixar CSV" (blob via interceptor; selo "parcial" quando não concluído).
- [ ] Exibir `encerradoPorNome`, `dataFim`, `pendenciasAoEncerrar`.
