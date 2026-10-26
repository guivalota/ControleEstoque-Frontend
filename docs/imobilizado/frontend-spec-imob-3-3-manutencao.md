# Spec de Frontend — Imobilizado: Ciclo da manutenção (Fase 3.3)

> Backend na branch `tbrt-imobilizado` (migration `0026_imob_os_manutencao`).
> Pré-requisitos: `3-1-ordens-servico`, `3-2-aprovacao-os` e o header `X-Empresa-Id`.
> Esta fatia **completa** o fluxo: agora o botão "Aprovar" vale também para `manutencao`.

---

## Fluxo da OS de manutenção

```
pendente --aprovar (admin)--> aprovada --concluir (admin|operador)--> concluida
   |                              |
   |                              +--cancelar (só admin)--> cancelada
   +--rejeitar (admin) / cancelar (solicitante|admin)--> rejeitada / cancelada
```

| Ação | Efeito nos bens | Quem |
|---|---|---|
| Aprovar | `ativo` → **`em_manutencao`** (histórico com `osId`); a OS fica **`aprovada`** (em andamento) e os bens **continuam presos a ela** (não entram em outra OS) | `admin` |
| Concluir | `em_manutencao` → **`ativo`** (histórico); OS **`concluida`**; grava `custoReal` (opcional), `concluidoPor…`, `concluidoEm` | `admin`, `operador` |
| Cancelar manutenção aprovada | `em_manutencao` → `ativo` (histórico); OS **`cancelada`** | **só `admin`** (operador, inclusive o solicitante → `403`) |

Os demais tipos não mudam: transferência, sinistro, venda e baixa continuam virando `concluida` na aprovação (spec 3.2). **Só a manutenção fica `aprovada`.**

### Regras
- Todas as ações são **tudo-ou-nada** e revalidam os bens sob lock: se algum bem não está mais `em_manutencao` (ex.: foi baixado por fora) ou foi excluído, a ação falha (`400`) listando os bens e nada muda.
- Bem num **inventário `em_andamento`** bloqueia aprovar, concluir e cancelar (mensagem com o nome do inventário).
- Rejeitar só vale para OS `pendente` (OS `aprovada` → `400`; use cancelar).
- Concluir só vale para manutenção `aprovada`; qualquer outro tipo/status → `400`.
- Sinistro/baixa de bem `em_manutencao` continuam possíveis, mas só abrindo OS **depois** que a manutenção terminar (o bem está preso à OS aprovada).

## 1. Aprovar manutenção — `POST /v1/imobilizado/ordens-servico/{id}/aprovar`

Igual à spec 3.2. Para `manutencao`, a resposta traz `status: "aprovada"`, `decididoPor…`/`decididoEm`/`motivoDecisao` preenchidos e `concluido…` nulos. Evento `aprovada` na trilha.

## 2. Concluir — `POST /v1/imobilizado/ordens-servico/{id}/concluir`

Roles: `admin`, `operador` (`leitura` → `403`). Corpo **opcional**:

```json
{ "comentario": "Trocada a fonte de alimentação", "custoReal": 320.75 }
```

- `custoReal` ≥ 0 (negativo → `400`); omitido = não informado (`custoReal: null`).
- `200` com o detalhe: `status: "concluida"`, `custoReal`, `concluidoPorId/Nome`, `concluidoEm`, evento `concluida` (com o comentário). `decididoPor…` continua sendo o admin que aprovou.
- `404` se a OS não existe/é de outra empresa.

| Erro `400` | Mensagem (exemplo) |
|---|---|
| OS não aprovada | `Só é possível concluir OS aprovadas (status atual: pendente).` |
| Outro tipo | `Só OS de manutenção podem ser concluídas (tipo atual: baixa).` |
| Custo negativo | `O custo real não pode ser negativo.` |
| Bem fora de manutenção | `A OS nº 7 não pode ser concluída: O bem P-001 está com status 'baixado' e não está mais em manutenção.` |
| Bem em inventário | `…O bem P-001 está no inventário em andamento 'Inventário 2026'; encerre-o antes.` |

## 3. Cancelar manutenção aprovada — `POST /v1/imobilizado/ordens-servico/{id}/cancelar`

Mesma rota da spec 3.1, agora aceitando OS `aprovada` **de manutenção** (corpo opcional `{ "comentario": "…" }`). Só `admin`; os demais recebem `403` com a mensagem do servidor. OS `aprovada` de outro tipo não existe (viram `concluida`).

## Resumo de botões na tela da OS

| Status | Tipo | Botões |
|---|---|---|
| `pendente` | qualquer | **Aprovar** (admin) · **Rejeitar** (admin) · **Cancelar** (solicitante ou admin) |
| `aprovada` | manutenção | **Concluir manutenção** (admin, operador) · **Cancelar** (admin) |
| `concluida` / `rejeitada` / `cancelada` | qualquer | nenhum (somente leitura) |

Fluxo de UI sugerido: "Concluir manutenção" abre um diálogo com `custoReal` (moeda, opcional; mostre `custoEstimado` como referência) e comentário. Na lista de OS, destaque as `aprovada` como "Em manutenção" (filtro `status=aprovada&tipo=manutencao`), com `previsaoConclusao` e `fornecedorServicoNome` para acompanhamento. No detalhe do bem, `status: em_manutencao` deve apontar para a OS aberta (`GET …/ordens-servico?bemId={id}&status=aprovada`).

## Pontos de atenção
- `custoReal`/`custoEstimado` são `number`; formate em BRL.
- Histórico do bem: dois registros `status` por manutenção (`ativo → em_manutencao` pelo admin que aprovou; `em_manutencao → ativo` por quem concluiu/cancelou), ambos com `osId`/`osNumero`.
- Concorrência: duas conclusões simultâneas → só uma tem sucesso, a outra recebe `400` ("status atual: concluida"). Recarregue a OS.
- Erros de regra: `400 { "error": "…" }`; papel indevido: `403`; OS de outra empresa: `404`.
