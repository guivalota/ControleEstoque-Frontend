# Spec de Frontend — Imobilizado: Painel de depreciação (Fase 4.4)

> Backend na branch `tbrt-imobilizado` (sem migration nova).
> Pré-requisitos: specs `4-1`, `4-2`, `4-3`, `X-Empresa-Id` e login. Papéis: `admin`, `operador`, `leitura`.
> **Aviso de produto:** regras sujeitas à validação de um contador (fatia 4.5).

## `GET /v1/imobilizado/depreciacao/dashboard`

Sem parâmetros. Uma chamada devolve tudo o que a tela inicial do módulo precisa.

```json
{
  "em": "2026-10-23",
  "metodologiaVersao": "1.0",
  "totais": { "chaveId": null, "nome": "TOTAL", "quantidade": 120, "valorAquisicao": 910000.00, "acumulada": 310000.00, "valorContabil": 600000.00 },
  "porCategoria": [ { "chaveId": 3, "nome": "Informática", "quantidade": 40, "valorAquisicao": 300000.00, "acumulada": 150000.00, "valorContabil": 150000.00 } ],
  "porStatus": [ { "chaveId": null, "nome": "ativo", "quantidade": 110, "valorAquisicao": 850000.00, "acumulada": 290000.00, "valorContabil": 560000.00 } ],
  "ultimosFechamentos": [ { "mes": "2026-06", "competencia": "2026-06-01", "revisao": 2, "totalBens": 118, "totalDepreciacao": 8300.00,
      "totalAcumulada": 280000.00, "totalValorContabil": 620000.00, "fechadoPorNome": "Maria", "fechadoEm": "2026-07-02T13:10:00Z" } ],
  "proximaCompetenciaAFechar": "2026-07-01",
  "ultimaCompetenciaFechavel": "2026-09-01",
  "mesesEncerradosSemFechamento": 3,
  "alertas": [ { "codigo": "meses_sem_fechamento", "severidade": "critico", "mensagem": "3 mês(es) encerrado(s) sem fechamento de depreciação.",
      "quantidade": 3, "destino": "fechamento-depreciacao" } ]
}
```

### Regras

- **Totais, por categoria e por status** são a posição de **hoje** (fim do mês de `em`, fuso de São Paulo) **calculada pelo cadastro atual** — não os valores congelados de um período. Entram só bens completos, adquiridos até o mês atual e ainda não baixados. Rotular o bloco como "Posição atual (calculada)" e, ao lado, mostrar os valores do último fechamento para o contador comparar.
- `ultimosFechamentos`: até 6 períodos vigentes, mais recente primeiro (vazio se nada foi fechado). `revisao > 1` → selo "revisado". Cada item leva ao histórico do período (spec 4.2).
- `proximaCompetenciaAFechar = null` → ainda não há período fechado. `mesesEncerradosSemFechamento` conta os meses encerrados desde o próximo a fechar.
- **`alertas`**: já vêm ordenados do mais grave ao menos grave e com texto pronto.

| `codigo` | `severidade` | `destino` (chave de navegação) |
|---|---|---|
| `meses_sem_fechamento` | `aviso` (1–2 meses) · `critico` (3+) | `fechamento-depreciacao` |
| `nenhum_periodo_fechado` | `info` | `fechamento-depreciacao` |
| `dados_incompletos` | `aviso` | `bens-dados-pendentes` |
| `bens_extraviados` | `aviso` | `bens-extraviados` |
| `os_pendentes` | `info` | `ordens-servico-pendentes` |
| `os_em_andamento` | `info` | `ordens-servico-em-andamento` |
| `inventarios_em_andamento` | `info` | `inventarios-em-andamento` |
| `bens_totalmente_depreciados` | `info` | `relatorio-valor-contabil` |

`destino` é uma **chave**, não uma URL: o front mapeia para a sua rota (ex.: `bens-dados-pendentes` → lista de bens com filtro de dados pendentes; `ordens-servico-pendentes` → lista de OS com `status=pendente`; `fechamento-depreciacao` → tela de fechamento). Se o papel do usuário não permitir a ação (ex.: `leitura` em `fechamento-depreciacao`), mostrar o alerta sem botão.

### Tela sugerida ("Depreciação" — página inicial do módulo)

1. Faixa de alertas no topo (cores por `severidade`; `critico` em destaque).
2. Cartões: **Valor de aquisição**, **Depreciação acumulada**, **Valor contábil**, **Bens** (da posição atual).
3. Gráficos simples: valor contábil por categoria (barras) e quantidade por status (rosca/barras); tabelas acessíveis como alternativa.
4. Lista dos últimos fechamentos (mês, revisão, totais, quem fechou) com link para o histórico; botão "Fechar {próximo mês}" (só `admin`) quando `mesesEncerradosSemFechamento > 0`.
5. Rodapé com a versão da metodologia e link para a Ajuda da depreciação.

### Erros

`401` sem token · `400` sem `X-Empresa-Id` · `403` sem vínculo com a empresa. Valores `number` com 2 casas; não somar nem arredondar no front.
