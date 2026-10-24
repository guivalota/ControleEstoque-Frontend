# Spec de Frontend — Imobilizado: Aprovação de ordens de serviço (Fase 3.2)

> Backend na branch `tbrt-imobilizado` (migration `0025_imob_os_aprovacao`).
> Pré-requisitos: `3-1-ordens-servico` e o header `X-Empresa-Id` (`0b-empresas`).
> **Nesta fatia a aprovação vale para `transferencia`, `sinistro`, `venda` e `baixa`.** OS de `manutencao` continua só podendo ser rejeitada ou cancelada (aprovar → `400`); o ciclo da manutenção chega na 3.3: não mostre o botão "Aprovar" para esse tipo ainda.

---

## Visão geral

Aprovar uma OS **aplica o efeito nos bens e fecha a OS na mesma operação** (tudo-ou-nada):

| Tipo | Efeito em cada bem | Status da OS depois |
|---|---|---|
| `transferencia` | muda `localId` e/ou `responsavelId` para o destino do item (o que não foi informado não muda); status do bem não muda | `concluida` |
| `sinistro` | status do bem → `extraviado` | `concluida` |
| `venda` | status do bem → `vendido` | `concluida` |
| `baixa` | status do bem → `baixado` | `concluida` |

- **Só `admin`** aprova (`operador`/`leitura` → `403`). O admin **pode aprovar a própria OS**.
- Só OS `pendente` (senão `400`). OS inexistente ou de outra empresa → `404`.
- Os bens são **revalidados na hora da aprovação**: podem ter mudado desde a abertura. Se qualquer um não servir mais, **nada é alterado** e a mensagem lista todos os bens com problema.
- Bem que está num **inventário `em_andamento`** bloqueia a aprovação (encerre ou cancele o inventário antes). Abrir a OS continua permitido.
- `decididoPor…`/`decididoEm` e `concluidoPor…`/`concluidoEm` ficam com o **admin que aprovou**; o comentário vai em `motivoDecisao` e no evento `aprovada`.
- Depois de aprovada, `baixado` e `vendido` são terminais: nenhuma OS nova aceita esses bens.

## 1. Aprovar — `POST /v1/imobilizado/ordens-servico/{id}/aprovar`

Role: `admin`. Corpo opcional:

```json
{ "comentario": "Aprovado conforme reunião de 20/10" }
```

`200` com o detalhe da OS (`ImobOrdemServicoDetalheResponse`):

```json
{ "id": 12, "numero": 5, "tipo": "baixa", "status": "concluida",
  "decididoPorId": "…", "decididoPorNome": "Admin", "decididoEm": "2026-10-23T12:00:00Z",
  "motivoDecisao": "Aprovado conforme reunião de 20/10",
  "concluidoPorId": "…", "concluidoEm": "2026-10-23T12:00:00Z",
  "eventos": [ { "evento": "criada", … }, { "evento": "aprovada", "comentario": "Aprovado conforme reunião de 20/10", … } ] }
```

Erros `400` (`{ "error": "…" }`, mostre a mensagem do servidor):

| Situação | Mensagem (exemplo) |
|---|---|
| OS não está pendente | `Só é possível aprovar OS pendentes (status atual: rejeitada).` |
| Manutenção (por enquanto) | `A aprovação de OS de manutenção ainda não está disponível.` |
| Bem mudou de status | `A OS nº 7 não pode ser aprovada: O bem P-001 está com status 'baixado' e não pode mais receber uma OS de venda.` |
| Vários bens com problema | a mesma mensagem, com **todos** os bens listados em sequência |
| Bem excluído | `O bem P-001 foi excluído.` |
| Bem em inventário | `O bem P-001 está no inventário em andamento 'Inventário 2026'; encerre-o antes de aprovar.` |
| Transferência: destino desativado/excluído | `Bem P-001: o local de destino foi excluído ou desativado.` · `…o responsável de destino…` |
| Transferência: bem já está no destino | `Bem P-001: o destino é igual à situação atual do bem.` |

Em qualquer `400` a OS continua `pendente` e nenhum bem é alterado. O admin pode então **rejeitar** (ou pedir que o solicitante cancele e abra de novo).

Fluxo de UI sugerido: na tela de detalhe da OS `pendente` (tipo diferente de `manutencao`), botão **Aprovar** (só `admin`) ao lado de **Rejeitar**. Diálogo de confirmação resumindo o efeito ("Os 3 bens ficarão com status *Baixado*. Esta ação não pode ser desfeita.") com campo de comentário opcional. Em caso de `400`, exiba a mensagem completa (pode ser longa) e mantenha o usuário na tela da OS. Após sucesso, recarregue a OS e invalide listas/consultas dos bens afetados.

## 2. Histórico do bem — campos novos

`GET /v1/imobilizado/bens/{id}/historico` passa a trazer, em cada item:

| Campo | Significado |
|---|---|
| `osId` | OS que causou a mudança (`null` para edição direta, criação, exclusão e ajustes do inventário) |
| `osNumero` | Número de exibição da OS (formate como `OS-000005`) |

E um novo valor de `campo`: **`status`** (`valorAnterior`/`valorNovo` = `ativo`, `em_manutencao`, `baixado`, `vendido`, `extraviado`). Para `local_id` e `responsavel_id` os campos `…Descricao` continuam trazendo o nome. `usuarioId`/`usuarioNome` são do **admin que aprovou**.

Na linha do tempo do bem, quando `osId` vier preenchido, mostre um link "OS-000005" para o detalhe da OS e rótulo amigável para `status` ("Status: Ativo → Baixado").

## Pontos de atenção

- **Botões por papel/tipo/status:** "Aprovar" só para `admin`, OS `pendente` e tipo ≠ `manutencao`. Não simule o efeito no front antes da resposta.
- **Conflito de aprovações:** duas aprovações simultâneas da mesma OS → só uma tem sucesso; a outra recebe `400` ("status atual: concluida"). Trate recarregando a OS.
- **OS aprovada nasce `concluida`** (não existe `aprovada` para esses tipos); o evento da trilha é `aprovada`. O selo de status deve usar `status`, a linha do tempo usa `eventos[].evento`.
- **Bens `extraviado`:** nesta fase só saem desse status por uma OS de `baixa` (ou pelo fluxo de inventário).
- Erros de regra sempre chegam como `400 { "error": "…" }`; `403` para papel indevido; `404` para OS de outra empresa.
