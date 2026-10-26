# Spec de Frontend — Imobilizado: Ordens de serviço — abrir, consultar, rejeitar e cancelar (Fase 3.1)

> Backend na branch `tbrt-imobilizado` (migration `0024_imob_ordens_servico`).
> Pré-requisitos: `0b-empresas` (header `X-Empresa-Id`), `1-1-locais`, `1-3-responsaveis`, `1-4-bens`.
> Desenho completo: `DESENHO_FASE_3_ORDENS_DE_SERVICO.md`. **Nesta fatia a OS só pode ser aberta, consultada, rejeitada ou cancelada.** A aprovação (que aplica o efeito no bem) e a conclusão da manutenção chegam nas fatias 3.2 e 3.3: não construa esses botões ainda (mostre apenas o status).

---

## Visão geral

Mudanças administrativas de um bem (transferir de local/responsável, mandar para manutenção, registrar sinistro, vender, baixar) passam a ser feitas **por uma OS**, aprovada por `admin`. A OS registra quem pediu, quem decidiu, por quê e o que mudaria. Abrir uma OS **não altera o bem**.

| Tipo | Bens elegíveis (status atual) | Dados da OS |
|---|---|---|
| `transferencia` | `ativo` | por bem: `localDestinoId` e/ou `responsavelDestinoId` (ao menos um, diferente do atual) |
| `manutencao` | `ativo` | opcionais: `fornecedorServicoNome`, `previsaoConclusao`, `custoEstimado` |
| `sinistro` | `ativo`, `em_manutencao` | — (a justificativa descreve o ocorrido) |
| `venda` | `ativo` | obrigatórios: `valorVenda` (≥ 0), `compradorNome`; opcionais: `dataVenda`, `numeroDocumento` |
| `baixa` | `ativo`, `em_manutencao`, `extraviado` | obrigatório: `motivoBaixa` = `obsolescencia`, `descarte`, `doacao`, `inservivel` ou `outro` |

Regras gerais:
- Uma OS tem de 1 a **200** bens, todos do mesmo tipo da OS.
- Um bem só pode estar em **uma OS aberta** (`pendente`) por vez. Bens `baixado`/`vendido` não aceitam nenhuma OS.
- A OS recebe um **número sequencial por empresa** (`numero`: 1, 2, 3…). A formatação de exibição (ex.: `OS-000123`) é do frontend.
- O status do bem **nunca** muda por edição direta: o `PUT /bens/{id}` continua sem alterar status.

### Status da OS

`pendente` → `rejeitada` (admin) · `cancelada` (solicitante ou admin). Nesta fatia só existe `pendente` como ponto de partida; `aprovada` e `concluida` aparecerão nas próximas fatias (a listagem já aceita esses valores no filtro).

### Permissões

| Ação | Quem |
|---|---|
| Listar e ver detalhe | `admin`, `operador`, `leitura` |
| Abrir | `admin`, `operador` |
| Rejeitar | **só `admin`** |
| Cancelar | o **solicitante** da OS ou `admin` (outro operador → `403`) |

Todas as rotas exigem `X-Empresa-Id`. OS (ou bem/local/responsável) de outra empresa **nunca** é revelada: aparece como "não encontrada".

---

## 1. Listar — `GET /v1/imobilizado/ordens-servico`

Query (todos opcionais): `busca` (número da OS **ou** trecho da plaqueta de algum bem), `tipo`, `status`, `bemId`, `solicitanteId`, `de`, `ate` (datas; `ate` inclui o dia inteiro), `page` (padrão 1), `pageSize` (padrão 50, **máx. 100**). Ordenação fixa: mais recentes primeiro. `tipo`/`status`/período inválidos → `400`.

Resposta `PagedResult<ImobOrdemServicoResumoResponse>`:

```json
{
  "items": [
    { "id": 12, "numero": 5, "tipo": "manutencao", "status": "pendente",
      "solicitanteId": "…", "solicitanteNome": "Maria", "totalItens": 2,
      "criadoEm": "2026-10-23T12:00:00Z", "decididoEm": null }
  ],
  "page": 1, "pageSize": 50, "total": 1
}
```

Para ver as OS de um bem (aba "Ordens de serviço" no detalhe do bem), use `?bemId={id}`.

## 2. Detalhe — `GET /v1/imobilizado/ordens-servico/{id}`

`404` se não existir ou for de outra empresa. Resposta `ImobOrdemServicoDetalheResponse` (todos os campos do resumo, mais):

| Campo | Significado |
|---|---|
| `justificativa` | Motivo informado ao abrir |
| `valorVenda`, `compradorNome`, `dataVenda`, `numeroDocumento` | Só `venda` |
| `motivoBaixa` | Só `baixa` |
| `fornecedorServicoNome`, `previsaoConclusao`, `custoEstimado`, `custoReal` | Só `manutencao` (`custoReal` só após a conclusão — fatia 3.3) |
| `decididoPorId/Nome`, `decididoEm`, `motivoDecisao` | Quem rejeitou (ou aprovou, a partir da 3.2) e o comentário |
| `concluidoPorId/Nome`, `concluidoEm` | Fatia 3.3 |
| `itens[]` | Bens da OS (abaixo) |
| `eventos[]` | Trilha, do mais antigo ao mais novo (abaixo) |

`itens[]`: `bemId`, `plaqueta`, `descricao`, `statusOrigem`, `localOrigemId/Nome`, `responsavelOrigemId/Nome` e, na transferência, `localDestinoId/Nome` e `responsavelDestinoId/Nome`. A **origem é uma "foto" do bem no momento da abertura** (pode divergir do cadastro atual — mostre como "situação na abertura").

`eventos[]`: `evento` (`criada`, `rejeitada`, `cancelada`; depois `aprovada`, `concluida`), `usuarioId/Nome`, `comentario`, `criadoEm`. Use como linha do tempo.

## 3. Abrir — `POST /v1/imobilizado/ordens-servico`

Roles: `admin`, `operador`. `201` com o detalhe (`Location` aponta para o `GET`).

```json
{
  "tipo": "venda",
  "justificativa": "Equipamento sem uso há 2 anos",
  "dados": { "valorVenda": 1999.90, "compradorNome": "Fulano", "dataVenda": "2026-10-20", "numeroDocumento": "NF-123" },
  "itens": [ { "bemId": 10 }, { "bemId": 11 } ]
}
```

Transferência:

```json
{
  "tipo": "transferencia",
  "justificativa": "Mudança de setor",
  "itens": [ { "bemId": 10, "localDestinoId": 4, "responsavelDestinoId": 7 } ]
}
```

- O **solicitante é sempre o usuário logado** (não envie `solicitanteId`/`empresaId`; são ignorados).
- `dados` só precisa dos campos do tipo; os demais são descartados. `localDestinoId`/`responsavelDestinoId` só valem na transferência.
- Campos de destino omitidos = "não muda". Destino igual à situação atual do bem → `400`.
- A operação é **atômica**: se qualquer bem for inelegível, nenhuma OS é criada.

Erros `400` (`{ "error": "…" }`, mostre a mensagem do servidor):

| Situação | Mensagem (exemplo) |
|---|---|
| Tipo inválido | `Tipo inválido. Valores aceitos: …` |
| Sem justificativa | `A justificativa é obrigatória.` |
| Sem bens / mais de 200 / bem repetido | `Informe ao menos um bem.` · `Uma OS aceita no máximo 200 bens.` · `O mesmo bem foi informado mais de uma vez.` |
| Venda sem valor/comprador, baixa sem motivo | `A venda exige o nome do comprador.` · `A baixa exige o motivo. …` |
| Bem inelegível para o tipo | `O bem P-001 está com status 'baixado' e não pode entrar em uma OS de venda.` |
| Bem já em OS aberta | `O bem P-001 já está na OS aberta nº 7.` |
| Bem/local/responsável inexistente, inativo ou de outra empresa | `Bem com id 99 não encontrado.` · `Local de destino não encontrado ou inativo.` |

Fluxo de UI sugerido: botão "Nova OS" na lista e também a partir da lista de bens/detalhe do bem (pré-selecionando o bem; para ações em lote, permita selecionar vários bens filtrados). Passo 1: escolher o tipo. Passo 2: selecionar bens (a busca de bens pode filtrar `status=ativo` para a maioria dos tipos) e preencher os dados do tipo (na transferência, um seletor de local/responsável **por bem**, com opção "aplicar a todos"). Passo 3: justificativa e confirmação. Mostre antes de enviar um resumo do que será pedido; deixe claro que **nada muda no bem até a aprovação**.

## 4. Rejeitar — `POST /v1/imobilizado/ordens-servico/{id}/rejeitar`

Role: `admin` (outros → `403`). Corpo com **comentário obrigatório**:

```json
{ "comentario": "Sem verba neste trimestre" }
```

`200` com o detalhe (`status: "rejeitada"`, `decididoPor…`, `motivoDecisao`). Os bens ficam livres para novas OS. `404` se a OS não existir/for de outra empresa; `400` se não estiver `pendente` ou se o comentário vier vazio.

## 5. Cancelar — `POST /v1/imobilizado/ordens-servico/{id}/cancelar`

Roles: `admin`, `operador`. O operador só cancela **a própria OS** (`403` caso contrário, com a mensagem do servidor); `admin` cancela qualquer OS pendente (útil quando o solicitante saiu da empresa). Corpo opcional:

```json
{ "comentario": "Desisti" }
```

`200` com o detalhe (`status: "cancelada"`). `404` se não existir; `400` se não estiver `pendente`. Os bens ficam livres.

> Nesta fatia só OS `pendente` pode ser cancelada. O cancelamento de manutenção já aprovada chega na fatia 3.3.

---

## Pontos de atenção

- **Botões por papel:** `leitura` não vê "Nova OS", "Rejeitar" nem "Cancelar". Operador vê "Cancelar" só nas OS em que `solicitanteId` é o seu usuário. "Rejeitar" só para `admin`, e só com a OS `pendente`.
- **Sem aprovação ainda:** uma OS `pendente` fica aguardando até a fatia 3.2. Não simule o efeito no front.
- **Bem em OS aberta:** ao listar bens, vale destacar quando o bem já está numa OS pendente (consulte `GET …/ordens-servico?bemId={id}&status=pendente`).
- **Foto de origem × cadastro atual:** o detalhe mostra a situação do bem na abertura; não a trate como situação atual.
- Datas em ISO 8601 (UTC); `dataVenda`/`previsaoConclusao` são apenas data (`yyyy-MM-dd`). Valores monetários em `number` (formate em BRL na tela).
- Erros de regra sempre chegam como `400 { "error": "…" }`.
