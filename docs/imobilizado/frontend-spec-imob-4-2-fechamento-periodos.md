# Spec de Frontend — Imobilizado: Fechamento de períodos, histórico e auditoria (Fase 4.2)

> Backend na branch `tbrt-imobilizado` (migration `0028_imob_depreciacao_fechamento`).
> Pré-requisitos: spec `4-1-depreciacao-bem` (cálculo por bem e Ajuda), `X-Empresa-Id` e login.
> **Aviso de produto:** as regras são a proposta técnica do sistema e só valem para uso contábil real depois da validação de um contador (fatia 4.5). Exibir o aviso da Ajuda nas telas de fechamento.

Todas as rotas abaixo exigem `X-Empresa-Id`, ficam em `/v1/imobilizado/depreciacao` e usam o **mês no formato `yyyy-MM`** (ex.: `2026-09`). Competência = primeiro dia do mês; nas respostas vem como data (`2026-09-01`) e também como `mes: "2026-09"`.

## Visão geral

| Ação | Rota | Quem |
|---|---|---|
| Prévia do mês (não grava) | `GET /previa?competencia=yyyy-MM` | `admin`, `operador` |
| Listar períodos fechados | `GET /periodos` | todos |
| **Fechar** o mês | `POST /periodos/{mes}/fechar` | **`admin`** |
| **Reabrir** o último período | `POST /periodos/{mes}/reabrir` | **`admin`** |
| Linha do tempo (auditoria) | `GET /periodos/{mes}/historico` | todos |
| Lançamentos de uma revisão | `GET /periodos/{mes}/revisoes/{n}` | todos |
| Comparar duas revisões | `GET /periodos/{mes}/comparar?de=1&para=2` | todos |

`leitura` consulta períodos, histórico, revisões e comparação, mas **não** vê a prévia nem os botões de fechar/reabrir (`403`).

## Conceitos

- **Fechar** grava, para cada bem, a quota do mês, a depreciação acumulada e o valor contábil, **congelando** as premissas e a classificação do bem (categoria, local, responsável, status). Editar o bem depois não muda um período fechado.
- **Revisão:** cada fechamento da mesma competência é uma revisão (1, 2, 3…). Reabrir arquiva os lançamentos (nada é apagado) e o novo fechamento cria a revisão seguinte.
- **Saldo de abertura** = acumulada − quota do mês (`saldoAbertura` nas linhas). Razão: abertura + quota = acumulada.
- **Sem buracos:** fecha-se sempre o mês seguinte ao último fechado. O **primeiro** fechamento da empresa pode ser de qualquer mês já encerrado (o admin escolhe).
- **Só meses encerrados:** o mês corrente (fuso de São Paulo) e os futuros não fecham.
- **Bloqueio de edição:** enquanto o bem tiver lançamento em período fechado, `dataAquisicao`, `valorAquisicao`, `valorResidual` e `vidaUtilMeses` não podem ser alterados no cadastro do bem (`PUT /bens/{id}` → `400`: *"Este bem já tem depreciação lançada em período fechado (último: 03/2025). Para alterar … reabra o último período de depreciação."*). Os demais campos seguem editáveis. Na tela do bem, desabilitar esses 4 campos quando o bem tiver depreciação fechada e mostrar essa orientação; o `400` do servidor continua sendo a regra.

## 1. Prévia — `GET /previa?competencia=2026-09&page=1&pageSize=50`

`pageSize` máximo 100. Competência futura ou inválida → `400`.

```json
{
  "competencia": "2026-09-01", "mes": "2026-09", "metodologiaVersao": "1.0",
  "fechavel": true, "motivoNaoFechavel": null, "jaFechada": false,
  "totais": { "totalBens": 120, "totalDepreciacao": 8450.00, "totalAcumulada": 91200.00, "totalValorContabil": 410000.00 },
  "pendencias": { "bensDadosIncompletos": 3, "bensEmOsDeBaixaOuVendaAberta": 2, "inventariosEmAndamento": 0 },
  "avisos": ["3 bem(ns) sem data ou valor de aquisição ficam fora da depreciação.", "..."],
  "linhas": { "items": [ { "bemId": 7, "plaqueta": "P-0007", "descricao": "Notebook", "categoriaId": 1, "categoriaNome": "Informática",
      "localId": 1, "localNome": "Matriz", "responsavelId": null, "responsavelNome": null, "statusBem": "ativo",
      "valorAquisicao": 12000.00, "valorResidual": 1200.00, "vidaUtilMeses": 60, "dataAquisicao": "2025-01-15", "dataBaixa": null,
      "saldoAbertura": 360.00, "quota": 180.00, "acumulada": 540.00, "valorContabil": 11460.00 } ],
    "page": 1, "pageSize": 50, "total": 120 }
}
```

- `fechavel=false` → mostrar `motivoNaoFechavel` e desabilitar "Fechar" (ex.: mês corrente, fora de sequência, já fechado, sem bens).
- `avisos` já vêm em texto; não impedem o fechamento. Mostrar antes da confirmação.
- A prévia **não entra** no histórico de auditoria.

## 2. Períodos — `GET /periodos?page=&pageSize=`

```json
{
  "periodos": { "items": [ { "competencia": "2026-08-01", "mes": "2026-08", "revisao": 1, "metodologiaVersao": "1.0",
      "totalBens": 118, "totalDepreciacao": 8300.00, "totalAcumulada": 82750.00, "totalValorContabil": 418000.00,
      "fechadoPorId": "…", "fechadoPorNome": "Maria", "fechadoEm": "2026-09-02T13:10:00Z" } ], "page": 1, "pageSize": 50, "total": 8 },
  "proximaCompetenciaAFechar": "2026-09-01",
  "ultimaCompetenciaFechavel": "2026-09-01",
  "mesesEncerradosSemFechamento": 1
}
```

- Mais recente primeiro. `revisao > 1` → mostrar selo "Revisão 2" (houve correção) com link para o histórico.
- `proximaCompetenciaAFechar = null` = ainda não há período fechado: o admin escolhe o mês inicial (qualquer mês encerrado).
- `mesesEncerradosSemFechamento > 0` → faixa de alerta "Há N mês(es) encerrado(s) sem fechamento".

## 3. Fechar — `POST /periodos/{mes}/fechar` (admin, sem corpo)

`200` com o período fechado (mesmo formato dos itens de `periodos`). Diálogo de confirmação mostrando o resultado da prévia (totais e avisos) e lembrando que, depois de fechado, só se corrige reabrindo o último período.

| `400` (mensagem do servidor) | Quando |
|---|---|
| `Só é possível fechar meses já encerrados…` | mês corrente ou futuro |
| `Os períodos devem ser fechados em sequência: feche antes 04/2025.` | pulou um mês |
| `O período 03/2025 já está fechado.` / `…é anterior ao último fechado…` | repetido/anterior (outro admin pode ter fechado antes: recarregar) |
| `Não há bens com depreciação em 03/2025.` | nenhum bem entra no mês |
| `Competência inválida…` | formato diferente de `yyyy-MM` |

Fechamentos simultâneos do mesmo mês: só um vence; os demais recebem `400` "já está fechado".

## 4. Reabrir — `POST /periodos/{mes}/reabrir` (admin)

Corpo **obrigatório**: `{ "motivo": "Valor de aquisição digitado errado" }` (1 a 500 caracteres; vazio → `400`). Só o **último** período fechado. `200` devolve o histórico da competência (item 5), já com o evento `reaberto`.

| `400` | Quando |
|---|---|
| `Informe o motivo da reabertura.` | motivo vazio |
| `O período 03/2025 não está fechado.` | não existe/ já reaberto |
| `Só o período mais recente pode ser reaberto: reabra antes 04/2025.` | há período posterior |

Diálogo: explicar que os lançamentos ficam **arquivados** (consultáveis como revisão anterior), pedir o motivo e orientar "corrija o cadastro e feche de novo".

## 5. Histórico (auditoria) — `GET /periodos/{mes}/historico`

`404` se a competência nunca foi fechada.

```json
{
  "competencia": "2025-03-01", "mes": "2025-03", "fechado": true, "revisaoVigente": 2,
  "eventos": [
    { "id": 1, "evento": "fechado", "revisao": 1, "usuarioId": "…", "usuarioNome": "Maria", "ocorridoEm": "2026-09-02T13:10:00Z",
      "motivo": null, "metodologiaVersao": "1.0",
      "totais": { "totalBens": 1, "totalDepreciacao": 180.00, "totalAcumulada": 540.00, "totalValorContabil": 11460.00 },
      "totaisAnteriores": null, "variacao": null },
    { "id": 2, "evento": "reaberto", "revisao": 1, "motivo": "Valor de aquisição digitado errado", "…": "…" },
    { "id": 3, "evento": "refechado", "revisao": 2,
      "totais": { "totalDepreciacao": 360.00, "…": "…" },
      "totaisAnteriores": { "totalDepreciacao": 180.00, "…": "…" },
      "variacao": { "totalDepreciacao": 180.00, "totalAcumulada": 360.00, "totalValorContabil": -360.00, "totalBens": 0 } }
  ]
}
```

- Ordem cronológica (mais antigo primeiro). Exibir como **linha do tempo**: ícone por `evento`, quem (`usuarioNome`), quando (`ocorridoEm`, converter para o fuso do usuário), `motivo`, totais e — no `refechado` — **totais anteriores e variação** (destacar positivo/negativo).
- Cada evento mostra a `metodologiaVersao` com que foi calculado.
- O registro é **permanente**: sem ações de editar/excluir.
- Botões em cada fechamento/refechamento: "Ver lançamentos da revisão N" e, quando há mais de uma revisão, "Comparar revisões".

## 6. Lançamentos de uma revisão — `GET /periodos/{mes}/revisoes/{n}?page=&pageSize=`

```json
{ "competencia": "2025-03-01", "mes": "2025-03", "revisao": 1, "vigente": false, "metodologiaVersao": "1.0",
  "totais": { "totalBens": 1, "totalDepreciacao": 180.00, "totalAcumulada": 540.00, "totalValorContabil": 11460.00 },
  "linhas": { "items": [ { "…mesmo formato das linhas da prévia…" } ], "page": 1, "pageSize": 50, "total": 1 } }
```

- `vigente=false` → faixa "Revisão arquivada: valores como estavam antes da correção".
- As linhas mostram as **premissas congeladas** (valores, datas, categoria/local/responsável/status da época). Os `…Nome` são os nomes **atuais** do cadastro para aquele id (podem ter sido renomeados).
- `404` se a revisão não existe nessa empresa.

## 7. Comparar revisões — `GET /periodos/{mes}/comparar?de=1&para=2&page=&pageSize=`

`400` se `de == para`; `404` se alguma revisão não existe. Retorna **só os bens que mudaram**:

```json
{ "competencia": "2025-03-01", "mes": "2025-03", "de": 1, "para": 2,
  "totaisDe": { "totalDepreciacao": 180.00, "…": "…" }, "totaisPara": { "totalDepreciacao": 360.00, "…": "…" },
  "diferencas": { "items": [
    { "bemId": 7, "plaqueta": "P-0007", "situacao": "alterado",
      "camposAlterados": ["quota", "acumulada", "valorContabil", "valorAquisicao", "valorResidual"],
      "antes": { "…linha…": "…", "valorAquisicao": 12000.00, "quota": 180.00 },
      "depois": { "…linha…": "…", "valorAquisicao": 24000.00, "quota": 360.00 } } ],
    "page": 1, "pageSize": 50, "total": 1 } }
```

- `situacao`: `alterado` (nos dois lados), `incluido` (`antes = null`: bem entrou na revisão nova) ou `removido` (`depois = null`).
- `camposAlterados` (camelCase): `quota`, `acumulada`, `valorContabil`, `valorAquisicao`, `valorResidual`, `vidaUtilMeses`, `dataAquisicao`, `dataBaixa`, `categoriaId`, `localId`, `responsavelId`, `statusBem`. Mostrar lado a lado **valor anterior → valor novo** só dos campos listados, com rótulos amigáveis.
- Cabeçalho com os totais das duas revisões e a diferença.

## Telas sugeridas

1. **Fechamento de depreciação** (menu do módulo; fechar/reabrir só para admin): faixa com `mesesEncerradosSemFechamento`; lista de períodos; botão "Fechar {próximo mês}" que abre a **prévia** (totais, avisos, tabela paginada) e o diálogo de confirmação.
2. **Histórico do período** (a partir da lista): linha do tempo (item 5), revisões e comparação (itens 6 e 7).
3. **Bem**: aba Depreciação (spec 4.1) ganha o aviso e o bloqueio dos 4 campos quando há depreciação fechada.
4. **Ajuda da depreciação** (spec 4.1) agora traz as seções *Fechamento de períodos*, *Reabertura e correções* e *Auditoria e histórico*; renderizar o que a API devolver.

## Observações

- Valores `number` com 2 casas; não somar nem arredondar no front.
- Datas `yyyy-MM-dd`; `ocorridoEm`/`fechadoEm` em UTC (converter para exibição).
- Após fechar ou reabrir, invalidar: lista de períodos, histórico e prévia da competência.
