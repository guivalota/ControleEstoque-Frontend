# Desenho da Fase 3 — Ordens de Serviço (OS) e aprovação

> **Status: APROVADO com as recomendações padrão de Q1–Q9.** Fatias 3.1 (0024), 3.2 (0025) e 3.3 (0026) implementadas; 3.5 (specs + Etapa 11 do PROMPT_FRONTEND.md) feita; 3.4 (e-mail, opcional) adiada. Desvios da 3.3: concluir recebe `p_custo_real`; helper `sp_devolver_bens_manutencao_imob_os` compartilhado por concluir/cancelar; concluir e cancelar também são bloqueados por inventário em andamento. Desvios da 3.2: o histórico usa `sp_registrar_historico_imob_bem_os` (nova, com `p_os_id`); a aprovação de tipos com efeito imediato registra só o evento `aprovada` e deixa a OS em `concluida` (com `concluido_por/em` = quem aprovou); a aprovação de `manutencao` é recusada até a 3.3 (que a redefine com CREATE OR REPLACE na migration 0026). Desvios do desenho na 3.1: `sp_insert_imob_os` recebe `p_justificativa` separado de `p_dados`; `sp_cancelar_imob_os` recebe `p_eh_admin`; `custo_real` e `numero_documento` já existem na tabela (usados nas fatias 3.3 e 3.2/Q4).
> Parte do plano em `PLANO_DE_ACAO.md` (Fase 3). Migrations a partir de **0024**.

## 1. Objetivo

Toda mudança "administrativa" de um bem (trocar de local/responsável, mandar para manutenção, registrar sinistro, vender, baixar) passa a acontecer **só por uma OS aprovada por `admin`**. A OS é a trilha de quem pediu, quem decidiu, por quê e o que mudou. O status do bem **nunca** é alterado por edição direta (`PUT /bens` já não altera status) — só por OS ou pelo inventário (resolução "ajusta local").

Fora desta fase: depreciação (Fase 4), e-mail (3.4 é opcional), perfil por empresa (Fase 5), app.

## 2. Tipos de OS e efeito no bem

| Tipo | Bem elegível (status atual) | Dados da OS | Efeito ao aprovar | Status final da OS |
|---|---|---|---|---|
| `transferencia` | `ativo` | por item: `local_destino_id` e/ou `responsavel_destino_id` (ao menos um, diferente do atual) | atualiza local e/ou responsável; status do bem **não muda** | `concluida` |
| `manutencao` | `ativo` | `fornecedor_servico_nome?`, `previsao_conclusao?`, `custo_estimado?` | bem → `em_manutencao` | `aprovada` (em andamento) até `concluir` |
| `sinistro` | `ativo`, `em_manutencao` | `justificativa` obrigatória (o que aconteceu) | bem → `extraviado` | `concluida` |
| `venda` | `ativo` | `valor_venda` (≥ 0) e `comprador_nome` obrigatórios, `data_venda` | bem → `vendido` | `concluida` |
| `baixa` | `ativo`, `em_manutencao`, `extraviado` | `motivo_baixa` (lista: `obsolescencia`, `descarte`, `doacao`, `inservivel`, `outro`) + justificativa | bem → `baixado` | `concluida` |

Regras gerais:
- `baixado` e `vendido` são **terminais**: nenhuma OS futura aceita esses bens.
- Uma OS tem 1..N itens (bens), todos do mesmo tipo da OS. Máx. 200 itens por OS.
- Um bem só pode estar em **uma OS aberta** (`pendente` ou `aprovada`) por vez.
- O estado do bem é **revalidado na aprovação** (pode ter mudado desde a abertura) e a aprovação é tudo-ou-nada: se um item deixou de ser elegível, a aprovação falha com mensagem listando os bens, nada é alterado.
- Reverter um efeito = nova OS (ex.: bem `extraviado` achado no inventário volta pelo fluxo do inventário/OS de transferência; "reativação" fica fora do escopo ❓Q6).

## 3. Máquina de estados da OS

```
            ┌──────────── cancelar (solicitante ou admin) ───────────┐
            │                                                        ▼
 (abrir) → pendente ── rejeitar (admin, comentário obrigatório) → rejeitada
            │
            └─ aprovar (admin) ─┬─ transferencia/sinistro/venda/baixa → concluida   (efeito aplicado na hora)
                                └─ manutencao → aprovada ── concluir (operador|admin) → concluida
                                                   │
                                                   └─ cancelar (admin) → cancelada  (bem volta a `ativo`)
```

Estados: `pendente`, `aprovada`, `rejeitada`, `concluida`, `cancelada`. Transições inválidas → `DomainException` (400). Estados finais: `rejeitada`, `concluida`, `cancelada`.

## 4. Modelo de dados (migration `0024_imob_ordens_servico.sql`)

Todas com `empresa_id NOT NULL`, índice iniciado por `empresa_id`, FKs compostas `(empresa_id, id)`, RLS habilitado como nas demais (sem política por sessão).

```
imob_os_numeracao    empresa_id (PK), ultimo INT          -- contador por empresa; UPDATE ... RETURNING (serializa)

imob_ordens_servico  id, empresa_id, numero INT (UNIQUE empresa_id+numero),
                     tipo, status, solicitante_id UUID, justificativa TEXT,
                     -- campos por tipo (nullable; validados na SP):
                     valor_venda NUMERIC(14,2), comprador_nome, data_venda DATE,
                     motivo_baixa, fornecedor_servico_nome, previsao_conclusao DATE, custo_estimado NUMERIC(14,2),
                     decidido_por UUID, decidido_em, motivo_decisao TEXT,
                     concluido_por UUID, concluido_em, criado_em, atualizado_em
                     CHECKs de tipo/status; sem soft delete (OS é registro permanente)

imob_os_itens        id, empresa_id, os_id, bem_id,
                     -- foto do bem na abertura (comparação e auditoria):
                     status_origem, local_origem_id, responsavel_origem_id,
                     local_destino_id?, responsavel_destino_id?,
                     UNIQUE (empresa_id, os_id, bem_id)
                     índice parcial único: um bem em no máx. 1 OS aberta
                       (via coluna `os_aberta BOOLEAN` mantida pelas SPs, UNIQUE (empresa_id, bem_id) WHERE os_aberta)

imob_os_eventos      id, empresa_id, os_id, evento ('criada','aprovada','rejeitada','cancelada','concluida'),
                     usuario_id UUID, comentario TEXT, criado_em    -- append-only (substitui `imob_os_aprovacoes` do rascunho)
```

Alteração **aditiva** em tabela existente (pedir aval, é do módulo mas já existe): `imob_bens_historico.os_id INT NULL` (FK composta opcional) para ligar cada mudança do bem à OS que a causou. Se preferir não tocar, a ligação fica só em `imob_os_eventos` ❓Q7.

## 5. Stored functions (todas com `p_empresa_id` primeiro)

| SP | O que faz (tudo numa transação) |
|---|---|
| `sp_insert_imob_os(p_empresa_id, p_usuario_id, p_tipo, p_dados JSONB, p_itens JSONB)` | gera `numero`; valida tipo/dados/itens; trava os bens (`FOR UPDATE`, ordenados por id) e confere elegibilidade e "sem OS aberta"; grava foto de origem; evento `criada`; retorna `id` |
| `sp_aprovar_imob_os(p_empresa_id, p_usuario_id, p_os_id, p_comentario)` | trava OS e bens (ordem por id); revalida; aplica o efeito do tipo; grava histórico do bem (`sp_registrar_historico_imob_bem`: `local_id`, `responsavel_id`, `status`); evento; define status final da OS |
| `sp_rejeitar_imob_os(...)` | exige comentário; libera os bens (`os_aberta = false`) |
| `sp_cancelar_imob_os(...)` | `pendente` (solicitante ou admin) ou `aprovada` de manutenção (admin: bem volta a `ativo` + histórico) |
| `sp_concluir_imob_os(...)` | só `manutencao` em `aprovada`: bem → `ativo`, histórico, `custo_real?` opcional |

Erros de regra usam `RAISE EXCEPTION` com mensagem própria (traduzidos em `DomainException`/400, como nas fases anteriores). OS ou bem de outra empresa → "não encontrado", nunca revela existência.

## 6. Endpoints (`v1/imobilizado/ordens-servico`)

| Método e rota | Papéis | Descrição |
|---|---|---|
| `GET /` | todos | lista paginada (≤100). Filtros: `tipo`, `status`, `bemId`, `solicitanteId`, `de`, `ate`, `busca` (nº/plaqueta) |
| `GET /{id}` | todos | detalhe: cabeçalho, itens (com plaqueta/descrição e origem/destino), eventos |
| `POST /` | admin, operador | abre OS; `solicitante` = usuário do JWT |
| `POST /{id}/aprovar` | **admin** | corpo `{ comentario? }` |
| `POST /{id}/rejeitar` | **admin** | corpo `{ comentario }` (obrigatório) |
| `POST /{id}/cancelar` | solicitante (pendente) ou admin | corpo `{ comentario? }` |
| `POST /{id}/concluir` | admin, operador | só manutenção aprovada; corpo `{ comentario?, custoReal? }` |
| `GET /bens/{bemId}/ordens-servico` (ou filtro `bemId`) | todos | OS do bem; o histórico do bem passa a mostrar o `osId` |

`403` para papel/solicitante indevido (tratado no controller, padrão `ImobLeituraPermissao`); `404` para OS de outra empresa; `409`/`400` para estado inválido (seguir o padrão atual: `DomainException` → 400).

DTOs: `CreateImobOrdemServicoRequest { tipo, justificativa, dados?, itens[] }`, `ImobOrdemServicoResponse`, `ImobOrdemServicoDetalheResponse`, `ImobOsItemResponse`, `ImobOsEventoResponse`, `DecisaoImobOsRequest`, `ConcluirImobOsRequest`.

## 7. Fatias de implementação (commits pequenos)

| Fatia | Entrega |
|---|---|
| **3.1** | migration 0024 (tabelas, `sp_insert`/`cancelar`/`rejeitar`), entidades, repositório, serviço, controller (abrir/listar/detalhe/cancelar/rejeitar) + testes + spec |
| **3.2** | `sp_aprovar` para transferência, baixa, venda e sinistro (efeito + histórico atômicos) + endpoint + testes |
| **3.3** | ciclo da manutenção (`aprovar` → `em_manutencao`, `concluir`, `cancelar` aprovada) + testes |
| **3.4** | e-mail opcional ao admin (nova OS) e ao solicitante (decisão), via `IEmailService`; falha de e-mail nunca desfaz a OS |
| **3.5** | spec(s) de frontend `frontend-spec-imob-3-*.md` e etapa 11 no `PROMPT_FRONTEND.md` |

## 8. Testes obrigatórios

- **Vazamento entre empresas** (2 empresas, 2 usuários): B não lista, lê, aprova, rejeita, cancela nem referencia OS/bem de A; bem de A numa OS de B → "não encontrado".
- **Atomicidade:** OS com N itens em que 1 é inelegível → nada muda; falha no meio da aprovação desfaz tudo (bem, histórico, evento).
- **Concorrência:** duas aprovações simultâneas da mesma OS (só uma vence); duas OS abertas ao mesmo tempo para o mesmo bem (só uma é criada); numeração sem buracos/duplicados por empresa sob concorrência.
- **Permissão:** `operador` e `leitura` não aprovam/rejeitam (403); `operador` não cancela OS de outro usuário; `leitura` não cria.
- **Elegibilidade por tipo/status** (tabela da seção 2), terminais `baixado`/`vendido` recusados, revalidação na aprovação.
- **Histórico:** cada efeito grava linha(s) em `imob_bens_historico` com o usuário que **aprovou**.
- **Integração com inventário** (conforme Q3).
- Convenção `Metodo_Cenario_ResultadoEsperado`; relatar resultados reais.

## 9. Decisões em aberto (❓) — responder antes de codar

| # | Pergunta | Recomendação (padrão) |
|---|---|---|
| Q1 | Os 5 tipos e os efeitos da seção 2 estão corretos? `sinistro` = bem fica `extraviado` (perda/roubo/dano grave)? | Sim. Dano total vira `baixa` por motivo `inservivel` |
| Q2 | Admin pode aprovar a **própria** OS? | Sim no MVP (pode haver só um admin); registrar no evento. Segregação de funções fica para a Fase 5 |
| Q3 | Bem que está no escopo de um **inventário `em_andamento`** pode ter OS aprovada que muda local/status? | **Bloquear a aprovação** (mensagem com o inventário) enquanto o inventário não for encerrado; abrir a OS continua permitido |
| Q4 | Venda: exige valor e comprador. Precisa de nota fiscal/documento? Gera algo para a depreciação (ganho/perda na alienação, Fase 4)? | Só guardar `valor_venda`, `comprador_nome`, `data_venda` e `numero_documento?` agora; contabilizar na Fase 4 com o contador |
| Q5 | Notificação por e-mail (3.4): vale a pena agora? | Deixar para o fim da fase; só se houver SMTP configurado no servidor |
| Q6 | Como "desfazer" `extraviado` (bem foi achado) ou erro de baixa? | Fora desta fase. `extraviado` → volta por resolução do inventário; `baixado`/`vendido` são terminais (correção via ajuste manual do admin, a desenhar depois) |
| Q7 | Adicionar `os_id` (nullable) em `imob_bens_historico`? | Sim — alteração aditiva simples, melhora muito a rastreabilidade na tela do histórico |
| Q8 | `transferencia` de bem `em_manutencao` é permitida? | Não: concluir a manutenção primeiro |
| Q9 | Numeração da OS: simples sequencial por empresa (`OS-000123`)? | Sim, `numero` inteiro por empresa; o formato de exibição é do frontend |

## 10. Riscos

- **Deadlock** ao travar vários bens: sempre travar na ordem crescente de `id`.
- **OS aberta "presa"** (solicitante saiu): admin pode cancelar qualquer OS pendente.
- **Aprovação em lote** de muitas OS: não é escopo; cada aprovação é uma transação curta.
- **Regras contábeis da venda/baixa:** o saldo contábil e o resultado da alienação só entram na Fase 4, com validação de contador.

## 11. Próximo passo

1. Usuário responde Q1–Q9 (ou aceita as recomendações).
2. Implementar 3.1 em commits pequenos: migration → domínio/repositório → serviço → controller → testes (inclusive vazamento entre empresas) → spec.
