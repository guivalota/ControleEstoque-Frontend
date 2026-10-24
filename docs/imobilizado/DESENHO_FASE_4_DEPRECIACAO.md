# Desenho da Fase 4 — Depreciação, fechamento de período e relatórios

> **Status: APROVADO em 2026-10-23; 4.1 a 4.4 e 4.6 implementadas; 4.5 (validação com contador) adiada — Q1–Q10 aceitas com as recomendações padrão; acrescidos os requisitos R1 (FAQ/metodologia consultável pelo frontend) e R2 (histórico de cálculos com valores anteriores), seção 12.** Parte do plano em `PLANO_DE_ACAO.md` (Fase 4). Migrations a partir de **0027**.
> **Aviso:** as regras contábeis abaixo são uma proposta técnica. Só valem para uso real após a validação com um contador (fatia 4.5; CPC 27 / IAS 16, taxas fiscais, valor residual).

## 1. Objetivo

Calcular a depreciação **linear** de cada bem, mostrar o valor contábil (aquisição − depreciação acumulada) em qualquer data, **fechar períodos mensais** gravando o resultado de forma imutável, e oferecer relatórios e um painel do módulo. Fora desta fase: outros métodos (soma dos dígitos, unidades produzidas), reavaliação/impairment, taxas fiscais diferentes das societárias, integração contábil/ERP.

## 2. O que já existe e o que falta

| Já existe | Detalhe |
|---|---|
| `imob_categorias` | `vida_util_meses`, `valor_residual_percentual`, `metodo_depreciacao = 'linear'` (valores-padrão que são copiados para o bem) |
| `imob_bens` | `data_aquisicao`, `valor_aquisicao`, `valor_residual`, `vida_util_meses` (da própria cópia do bem), `status`, `deletado_em`. Bem com data ou valor nulo = "dados incompletos" → **fora da depreciação** (decisão da migration 0017) |
| OS aprovadas | status `baixado`/`vendido` com histórico (`imob_bens_historico` com `os_id`) e, na venda, `valor_venda` na OS |
| Infra de relatórios | `CsvExporter`, QuestPDF (relatório de inventário 2.5), `AlertaBackgroundService` (modelo de serviço agendado) |

| Falta | |
|---|---|
| Data efetiva da baixa/venda | Hoje só dá para deduzir do histórico; a depreciação precisa dela. Proposta: coluna `imob_bens.data_baixa` (Q4) |
| Tabelas de período e lançamento | `imob_periodos_depreciacao`, `imob_depreciacao` (seção 4) |
| Cálculo, fechamento, relatórios, painel | Seções 3, 5, 6 |

## 3. Regras de cálculo (linear)

Para um bem com dados completos:

- **Base depreciável** = `valor_aquisicao − valor_residual` (≥ 0; o CHECK do bem já garante residual ≤ aquisição).
- **Quota mensal** = `base / vida_util_meses`, arredondada a 2 casas (arredondamento comercial, *away from zero*).
- **Início** (Q1): mês cheio a partir do **mês da aquisição** (proposta). Alternativas: mês seguinte; *pro rata* por dias.
- **Fim**: após `vida_util_meses` quotas o bem chega ao residual e **para**. A **última quota é ajustada** (`base − soma das anteriores`) para que o total feche exatamente na base, absorvendo o arredondamento.
- **Acumulada até a competência `c`** = fórmula fechada (sem depender de lançamentos anteriores): `min(n, vida) × quota`, com a última quota ajustada quando `n ≥ vida`, onde `n` = meses entre o início e `c` (inclusive).
- **Valor contábil em `c`** = `valor_aquisicao − acumulada(c)` (nunca abaixo do residual).
- **Status e depreciação** (Q3): `ativo` e `em_manutencao` depreciam; `extraviado` continua depreciando até ser baixado (proposta); `baixado`/`vendido` param.
- **Baixa/venda** (Q4): a depreciação vai **até o mês anterior** ao mês da baixa (proposta: não deprecia o mês da baixa). A data efetiva é a da **aprovação da OS** (fuso `America/Sao_Paulo`); `data_venda` da OS continua informativa.
- Bem excluído (`deletado_em`), ou com dados incompletos: não entra em prévia nem em fechamento.
- Competência = primeiro dia do mês (`DATE`). Valores `NUMERIC(14,2)`; em C#, `decimal`.

**Fonte única do cálculo** (Q7): uma função SQL pura e imutável (`fn_imob_depreciacao_acumulada(...)`) usada pela prévia e pelo fechamento (processamento em conjunto, rápido para ~10 mil bens), mais uma classe C# `DepreciacaoLinear` para o cronograma de um bem. Um **teste de paridade** compara as duas em centenas de casos (vida 1..1200, residual 0/100%, arredondamentos, datas limites, baixa no meio).

## 4. Modelo de dados

Todas as tabelas com `empresa_id NOT NULL`, índice iniciado por `empresa_id`, FKs compostas `(empresa_id, id)`, RLS habilitado como nas demais, SPs com `p_empresa_id` primeiro.

```
imob_bens                        + data_baixa DATE NULL   -- preenchida por sp_aprovar_imob_os (baixa/venda); backfill pelo histórico

imob_periodos_depreciacao        id, empresa_id, competencia DATE (1º dia),
                                 status ('fechado'), fechado_por UUID, fechado_em,
                                 total_bens INT, total_depreciacao, total_acumulada, total_valor_contabil   -- totais gravados
                                 UNIQUE (empresa_id, competencia)

imob_depreciacao                 id, empresa_id, periodo_id, bem_id, competencia DATE,
                                 valor NUMERIC(14,2),            -- quota do mês
                                 acumulada NUMERIC(14,2),        -- até o fim da competência
                                 valor_contabil NUMERIC(14,2),
                                 -- premissas congeladas (auditoria; o bem pode ser editado depois):
                                 valor_aquisicao, valor_residual, vida_util_meses, data_aquisicao,
                                 categoria_id, local_id, responsavel_id, status_bem,
                                 UNIQUE (empresa_id, bem_id, competencia)
```

- `acumulada − valor` = **saldo de abertura** do bem naquele mês. No primeiro fechamento da empresa (e quando um bem passa a ter dados completos depois) o bem entra com a acumulada calculada pela fórmula, **sem lançar meses antigos**; o relatório de razão mostra "saldo de abertura + depreciação do mês = saldo final".
- As premissas e a classificação (categoria/local/responsável/status) são **congeladas** no lançamento, para que relatórios de períodos fechados não mudem quando o cadastro mudar.
- Lançamentos de períodos fechados são **imutáveis** (sem UPDATE/DELETE pela aplicação, exceto a reabertura do último período — seção 5).

## 5. Fechamento de período (4.2)

- **Só `admin`**. Um período por empresa e mês; **sem buracos**: fecha-se a competência seguinte à última fechada. O primeiro período fechado da empresa define o início (Q5). Só competências **já encerradas** (anteriores ao mês corrente, no fuso de São Paulo) podem ser fechadas (Q6).
- `POST …/periodos/{yyyy-MM}/fechar` (transação única): trava o período e os bens (`FOR SHARE`, ordem por id) para que edições concorrentes esperem; calcula pela função SQL; insere os lançamentos e os totais; falha → nada é gravado. Idempotência: fechar um mês já fechado → `400`.
- **Prévia** (`GET …/depreciacao/previa?competencia=`): o mesmo cálculo sem gravar, com lista de **pendências** (bens com dados incompletos que ficarão de fora, bens de OS pendentes que mudarão o resultado, inventário em andamento — apenas avisos).
- **Reabrir o último período** (`POST …/periodos/{yyyy-MM}/reabrir`, só admin, só o **mais recente**, com motivo obrigatório): apaga seus lançamentos e registra o evento em trilha própria (`imob_periodos_eventos`, append-only). Permite corrigir cadastro e refazer. Períodos anteriores só reabrem em cascata (Q8).
- **Bloqueio de edição** (Q8): enquanto o bem tiver lançamento em período fechado, `valor_aquisicao`, `valor_residual`, `vida_util_meses` e `data_aquisicao` não podem ser alterados (`400` explicando, com a orientação de reabrir o último período). Os demais campos (local, responsável, descrição…) seguem editáveis.
- **Automação** (Q9): sem `BackgroundService` por padrão — fechar é decisão contábil. Pode virar opção depois da validação do contador (4.5).

## 6. Endpoints (`v1/imobilizado/depreciacao`) e relatórios

| Método e rota | Papéis | Descrição |
|---|---|---|
| `GET /bens/{id}` | todos | cronograma completo do bem (mês a mês, calculado) + valor contábil em `?em=yyyy-MM-dd` (4.1) |
| `GET /previa?competencia=` | admin, operador | cálculo do mês sem gravar, com totais e pendências (4.2) |
| `GET /periodos` | todos | períodos fechados e totais; indica o próximo a fechar |
| `POST /periodos/{yyyy-MM}/fechar` | **admin** | fecha o período (4.2) |
| `POST /periodos/{yyyy-MM}/reabrir` | **admin** | reabre o último período, motivo obrigatório (4.2) |
| `GET /relatorios/razao?competencia=&agrupar=bem\|categoria` | todos | razão: abertura + depreciação = saldo, por bem ou categoria (4.3) |
| `GET /relatorios/valor-contabil?em=&categoriaId=&localId=&responsavelId=` | todos | valor contábil por bem na data (último período fechado ≤ data, ou calculado se ainda não fechado) |
| `GET /relatorios/bens-por-dimensao?por=categoria\|local\|responsavel\|status` | todos | quantidade, valor de aquisição, acumulada e contábil |
| `GET /relatorios/baixas?de=&ate=` | todos | baixas e vendas do período: valor contábil na baixa, valor de venda, **ganho/perda** (valor de venda − contábil) |
| `GET /dashboard` | todos | painel do módulo (4.4) |

- Todos os relatórios aceitam `formato=json\|csv\|pdf` (CSV/PDF via blob por causa do header `X-Empresa-Id`; limite de linhas como na exportação de bens; paginação ≤ 100 no JSON).
- **Painel (4.4):** totais (bens, valor de aquisição, depreciação acumulada, valor contábil), por categoria e status, últimos fechamentos, e alertas: bens com dados incompletos, OS pendentes, inventários em andamento, períodos a fechar.
- Todos com `empresaId` do `ITenantContext`; `usuarioId` do JWT; recurso de outra empresa = "não encontrado".

## 7. Fatias de implementação (commits pequenos)

| Fatia | Entrega |
|---|---|
| **4.1 ✅** | migration 0027 (`data_baixa` + backfill, função SQL de depreciação), `DepreciacaoLinear` (C#), `GET /bens/{id}`, testes unitários (tabela de casos) e de paridade SQL × C#, vazamento entre empresas |
| **4.2 ✅** | migration 0028 (períodos, lançamentos, eventos, SPs prévia/fechar/reabrir, bloqueio de edição), endpoints, testes de atomicidade/concorrência/vazamento |
| **4.3 ✅** | relatórios (JSON/CSV/PDF) |
| **4.4 ✅** | dashboard |
| **4.5** | checklist de validação com o contador (documento + ajustes das regras aprovadas) — **antes de uso real** |
| **4.6** | specs de frontend `frontend-spec-imob-4-*.md` e Etapa 12 no `PROMPT_FRONTEND.md` |

## 8. Testes obrigatórios

- **Cálculo (unitário, tabela de casos):** vida 1 mês; vida 12 com residual 0; residual = 100% (quota zero); arredondamento com resto (última quota ajustada); competência antes do início, no início, no meio, exatamente no fim e depois do fim; baixa no meio; mês de aquisição no dia 31; ano bissexto.
- **Paridade:** SQL × C# em centenas de combinações geradas.
- **Vazamento entre empresas (2 empresas, 2 usuários):** B não vê, não fecha, não reabre nem relata períodos/lançamentos da A; fechar na A não altera B.
- **Atomicidade/concorrência:** falha no meio do fechamento não grava nada; dois fechamentos simultâneos da mesma competência (só um vence); edição de bem concorrente ao fechamento; sem buracos de períodos.
- **Imutabilidade:** lançamentos congelam as premissas; editar o bem (campos livres) não muda relatórios do período; campos de depreciação bloqueados com lançamento; reabrir só o último.
- **Papéis:** `operador`/`leitura` não fecham nem reabrem (`403`); `leitura` consulta tudo.
- Convenção `Metodo_Cenario_ResultadoEsperado`; relatar resultados reais.

## 9. Decisões (Q1–Q10 aceitas em 2026-10-23 com as recomendações abaixo)

| # | Pergunta | Recomendação (padrão) |
|---|---|---|
| Q1 | Quando começa a depreciar? | Mês cheio a partir do **mês da aquisição** (simples e previsível). Alternativas: mês seguinte; *pro rata* diário. **Confirmar com o contador (4.5)** |
| Q2 | Arredondamento | Quota a 2 casas, comercial (*away from zero*); **última quota ajustada** para fechar a base exata |
| Q3 | `extraviado` e `em_manutencao` continuam depreciando? | Sim, até serem baixados/vendidos |
| Q4 | Data efetiva da baixa/venda e tratamento do mês | Data da **aprovação da OS** (coluna `imob_bens.data_baixa`, fuso São Paulo); não deprecia o mês da baixa; `data_venda` só informativa. Ganho/perda na venda só em relatório (valor de venda − valor contábil) |
| Q5 | Como começar com bens antigos (adquiridos antes do 1º fechamento)? | **Saldo de abertura calculado pela fórmula** no 1º fechamento (sem lançar meses antigos); o admin escolhe a competência inicial |
| Q6 | Pode fechar o mês corrente? | Não: só meses já encerrados (competência < mês atual) |
| Q7 | Onde fica o cálculo? | **Uma função SQL** como fonte única (prévia e fechamento em conjunto) + classe C# para o cronograma, com **teste de paridade** |
| Q8 | Corrigir cadastro depois de fechar | Bloquear os 4 campos de depreciação do bem com lançamentos; correção = **reabrir só o último período** (admin, com motivo e trilha), editar e refechar. Períodos mais antigos: reabrir em cascata |
| Q9 | Fechamento automático mensal (`BackgroundService`)? | Não por padrão; reavaliar depois da validação do contador |
| Q10 | Relatórios: formatos e limites | JSON + CSV + PDF; limite de linhas como na exportação de bens (20.000) com mensagem de refinar filtros |

## 10. Riscos

- **Regra contábil errada** (início, residual, extravio, baixa): mitigada por isolar o cálculo, testes em tabela e a validação do contador (4.5) **antes** de qualquer uso real; premissas congeladas permitem refazer períodos sem perder a trilha.
- **Divergência SQL × C#:** teste de paridade obrigatório em toda alteração do cálculo.
- **Edição concorrente durante o fechamento:** `FOR SHARE` nos bens + bloqueio de campos com lançamento.
- **Fechamento pesado (≈ 10 mil bens):** processamento em conjunto numa só instrução, medido em teste de volume; transação curta.
- **Fuso horário:** competência e data da baixa sempre no fuso de São Paulo, nunca `DateTime.UtcNow` direto.
- **Período aberto "esquecido":** a prévia e o painel avisam quando há meses encerrados sem fechamento.

## 11. Próximo passo

1. ~~Usuário responde Q1–Q10~~ — aceitas em 2026-10-23 (+ R1 e R2, seção 12).
2. Implementar 4.1: migration 0027 → função SQL e `DepreciacaoLinear` → endpoint → testes (inclusive paridade e vazamento) → spec.

## 12. Requisitos adicionados pelo usuário (2026-10-23)

Os contadores precisam **conferir como a depreciação é calculada** e **auditar quando e com quais valores** ela foi calculada, tudo consultável pelo frontend.

### R1 — Ajuda e metodologia (FAQ) consultável no frontend

- Conteúdo **versionado** (`metodologiaVersao`, ex.: `1.0`) servido pela API, escrito em linguagem de contador: o que é, fórmulas, **exemplos numéricos**, premissas (Q1–Q10), glossário, limites do sistema e o que é decidido pelo contador. Fica em código (`Application/Imobilizado/Depreciacao/DepreciacaoAjuda`), com teste que impede divergência entre o texto e as constantes do cálculo (ex.: o exemplo numérico da FAQ é recalculado pelo `DepreciacaoLinear` no teste).
- `GET v1/imobilizado/depreciacao/ajuda` → `{ versao, atualizadoEm, secoes:[{ slug, titulo, ordem, itens:[{ slug, pergunta, resposta(markdown) }] }] }`; `GET …/ajuda/{slug}` → seção; `?q=` filtra por texto (busca simples). Leitura para todos os papéis; não depende de empresa (conteúdo global), mas exige autenticação.
- **Memória de cálculo por bem:** `GET …/depreciacao/bens/{id}` devolve, além do cronograma, a explicação passo a passo **com os números do bem** (base, quota, início, fim, última quota ajustada, mês da baixa, regra aplicada em cada status) e a `metodologiaVersao`. Assim o contador confere um bem sem usar a calculadora.
- Cada período fechado grava a `metodologia_versao` com que foi calculado; mudar a regra no futuro cria nova versão sem alterar o que foi fechado.
- Seções da FAQ (4.1 cobre as 4 primeiras; 4.2 completa o restante): *Como calculamos*, *Quando começa e termina*, *Status e baixas*, *Arredondamento e saldo de abertura*, *Fechamento de períodos*, *Reabertura e correções*, *Auditoria e histórico*, *Relatórios*, *Glossário*, *O que o contador precisa validar*.

### R2 — Histórico de cálculos com valores anteriores (auditoria)

- **Nada que já foi calculado e gravado é apagado.** Ao reabrir um período, os lançamentos vão para `imob_depreciacao_arquivo` (mesmas colunas + `periodo_id`, `revisao`, `arquivado_em`, `arquivado_por`, `motivo`) antes de serem removidos, e o período passa a ter `revisao` incrementada ao refechar (`1`, `2`, …). Tabelas append-only (sem UPDATE/DELETE pela aplicação, como `imob_periodos_eventos`).
- `imob_periodos_eventos` (append-only): `fechado`, `reaberto`, `refechado`, com `usuario_id`, `ocorrido_em`, `revisao`, `motivo`, **totais no momento do evento** (bens, depreciação, acumulada, valor contábil), `metodologia_versao` e, no refechamento, **totais anteriores** e variação.
- **Comparação entre revisões** por bem: valor anterior × novo da quota, acumulada e valor contábil, e das premissas (aquisição, residual, vida útil, data) que mudaram — para o contador entender *por que* o número mudou.
- Endpoints (4.2): `GET …/periodos/{yyyy-MM}/historico` (linha do tempo de eventos e revisões, com quem e quando), `GET …/periodos/{yyyy-MM}/revisoes/{n}` (lançamentos daquela revisão, paginado ≤ 100), `GET …/periodos/{yyyy-MM}/comparar?de=1&para=2` (diferenças por bem, só os que mudaram), CSV/PDF na 4.3. Leitura para todos os papéis; tudo escopado por empresa (vazamento testado).
- A **prévia** não grava nada; fica de fora do histórico (não é cálculo oficial). Alterações cadastrais do bem seguem no `imob_bens_historico` já existente.
- Testes: reabrir preserva 100% das linhas anteriores no arquivo; refechar mantém revisões 1..n; comparação mostra só os bens alterados com valores antigo/novo; arquivo e eventos não aceitam UPDATE/DELETE; vazamento entre empresas.

### Impacto nas fatias

| Fatia | Acréscimo |
|---|---|
| 4.1 | `DepreciacaoAjuda` (FAQ seções 1–4) + `GET /ajuda` + memória de cálculo em `GET /bens/{id}` + teste de coerência FAQ × cálculo |
| 4.2 | `revisao`, `metodologia_versao`, `imob_depreciacao_arquivo`, eventos com totais anteriores, endpoints de histórico/revisões/comparar; FAQ seções 5–7 |
| 4.3 | histórico e comparação em CSV/PDF; FAQ seções 8–10 |
| 4.5 | a FAQ vira o roteiro de validação com o contador (cada item "a validar" fica marcado) |
| 4.6 | telas "Ajuda da depreciação" e "Histórico do período" nas specs do frontend |

### Desvios registrados na 4.3

- `valor-contabil` e `bens-por-dimensao` usam o **cadastro atual** calculado até o fim do mês de `em` (e não "o último período fechado ≤ data"), para funcionarem também em meses ainda não fechados. O **razão** é que lê os valores congelados (com `revisao`). A diferença está explicada na Ajuda (`razao-x-valor-contabil`).
- Razão aceita agrupar por `bem`, `categoria`, `local`, `responsavel` e `status`.
- Ganho/perda é calculado **por OS** (o valor de venda é da OS inteira); nos arquivos aparece só na primeira linha de cada OS.
