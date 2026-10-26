# Spec de Frontend — Imobilizado: Relatórios de depreciação (Fase 4.3)

> Backend na branch `tbrt-imobilizado` (sem migration nova: usa as tabelas da 0028).
> Pré-requisitos: specs `4-1` (cálculo e Ajuda) e `4-2` (fechamento e auditoria), `X-Empresa-Id` e login.
> **Aviso de produto:** regras sujeitas à validação de um contador (fatia 4.5); exibir o aviso da Ajuda nas telas de relatório.

Todas as rotas exigem `X-Empresa-Id`. Papéis: `admin`, `operador` e `leitura` (relatórios são só leitura).

## Parâmetro comum `formato`

`formato=json` (padrão) | `csv` | `pdf`.

- **json**: paginado (`page`, `pageSize` máx. 100) quando há listas longas.
- **csv / pdf**: arquivo completo (sem paginação), até **20.000 linhas**; acima disso `400` *"O relatório tem N linhas e o limite de exportação é 20000. Refine os filtros."*.
- **Download:** o header `X-Empresa-Id` não vai em link direto. Baixe via `fetch`/Axios como **blob** (interceptor já injeta o header) e use o nome em `Content-Disposition` (ex.: `razao-2026-03-rev1-bem.csv`). Mostrar spinner (pode levar alguns segundos).
- CSV: UTF-8 com BOM, separador `,`, números com **ponto decimal e 2 casas**, datas `yyyy-MM-dd`, horas em Brasília. Pronto para Excel/Sheets.
- `formato` inválido → `400` *"Formato inválido. Valores aceitos: json, csv, pdf."*

Rotas em `/v1/imobilizado/depreciacao/relatorios`.

## 1. Razão — `GET /razao`

Do **período fechado** (valores congelados no fechamento).

| Parâmetro | Descrição |
|---|---|
| `competencia` | **obrigatório**, `yyyy-MM` |
| `agrupar` | `bem` (padrão), `categoria`, `local`, `responsavel` ou `status` |
| `revisao` | opcional; padrão = revisão vigente. Use para ver uma revisão arquivada |
| `formato`, `page`, `pageSize` | ver acima |

```json
{ "competencia": "2025-03-01", "mes": "2025-03", "revisao": 1, "vigente": true, "metodologiaVersao": "1.0", "agrupar": "bem",
  "totais": { "quantidade": 2, "valorAquisicao": 18000.00, "saldoAbertura": 860.00, "quota": 680.00, "acumulada": 1540.00, "valorContabil": 16460.00 },
  "linhas": { "items": [ { "chaveId": null, "nome": "REL-1", "bemId": 7, "descricao": "Notebook", "quantidade": 1,
      "valorAquisicao": 12000.00, "saldoAbertura": 360.00, "quota": 180.00, "acumulada": 540.00, "valorContabil": 11460.00 } ],
    "page": 1, "pageSize": 50, "total": 2 } }
```

- **Saldo de abertura + quota do mês = depreciação acumulada** em toda linha e nos totais.
- `agrupar=bem`: `nome` = plaqueta. Demais: `nome` = categoria/local/responsável/status e `chaveId` = id do cadastro (`null` para status e "(sem responsável)").
- Totais são do período inteiro, não só da página.
- `404` se o período não está fechado ou a revisão não existe. `vigente=false` → faixa "revisão arquivada".

## 2. Valor contábil — `GET /valor-contabil`

Posição de cada bem ao **fim do mês** da data `em`, **calculada pelo cadastro atual** (não é o valor congelado; para isso use o razão).

| Parâmetro | Descrição |
|---|---|
| `em` | `yyyy-MM-dd`, padrão hoje (São Paulo); 1900–2200 |
| `categoriaId`, `localId`, `responsavelId`, `status` | filtros opcionais (status inválido → `400`) |
| `formato`, `page`, `pageSize` | ver acima |

```json
{ "em": "2025-03-31", "metodologiaVersao": "1.0", "observacao": "Posição calculada pelo cadastro atual…",
  "totais": { "totalBens": 2, "totalValorAquisicao": 18000.00, "totalAcumulada": 1540.00, "totalValorContabil": 16460.00 },
  "bensDadosIncompletos": 3,
  "itens": { "items": [ { "bemId": 7, "plaqueta": "REL-1", "descricao": "Notebook", "categoriaNome": "Informática", "localNome": "Matriz",
      "responsavelNome": null, "status": "ativo", "dataAquisicao": "2025-01-15", "valorAquisicao": 12000.00, "valorResidual": 1200.00,
      "vidaUtilMeses": 60, "acumulada": 540.00, "valorContabil": 11460.00 } ], "page": 1, "pageSize": 50, "total": 2 } }
```

- Ficam **fora**: bens excluídos, sem data/valor de aquisição (contados em `bensDadosIncompletos` — mostrar aviso com link para a lista de bens "dados pendentes"), adquiridos depois do mês de `em` e **já baixados/vendidos até `em`**.
- Mostrar a `observacao` junto do resultado.

## 3. Bens por dimensão — `GET /bens-por-dimensao`

`por` = `categoria` (padrão) | `local` | `responsavel` | `status`; `em` e `formato` como acima. Mesma regra de inclusão do valor contábil. Não é paginado.

```json
{ "por": "categoria", "em": "2025-03-31", "metodologiaVersao": "1.0",
  "totais": { "chaveId": null, "nome": "TOTAL", "quantidade": 2, "valorAquisicao": 18000.00, "acumulada": 1540.00, "valorContabil": 16460.00 },
  "linhas": [ { "chaveId": 3, "nome": "Informática", "quantidade": 1, "valorAquisicao": 12000.00, "acumulada": 540.00, "valorContabil": 11460.00 } ] }
```

Sugestão: tabela + gráfico de barras do valor contábil por grupo (opcional).

## 4. Baixas e vendas — `GET /baixas`

Bens `baixado`/`vendido` com **data da baixa** (data da aprovação da OS) entre `de` e `ate` (inclusive). Padrão: 1º de janeiro do ano de `ate` até hoje. `de > ate` → `400`.

```json
{ "de": "2026-01-01", "ate": "2026-10-23", "metodologiaVersao": "1.0",
  "totais": { "quantidade": 3, "valorContabil": 9000.00, "totalVendas": 8000.00, "ganhoPerdaTotal": -1000.00 },
  "itens": { "items": [ { "bemId": 1, "plaqueta": "A1", "descricao": "…", "categoriaNome": "…", "status": "vendido", "dataBaixa": "2026-05-10",
      "osId": 10, "osNumero": 4, "valorAquisicao": 5000.00, "depreciacaoAcumulada": 2000.00, "valorContabil": 3000.00 } ], "page": 1, "pageSize": 50, "total": 3 },
  "ordens": [ { "osId": 10, "osNumero": 4, "tipo": "venda", "dataBaixa": "2026-05-10", "quantidade": 2,
      "valorContabil": 7000.00, "valorVenda": 8000.00, "ganhoPerda": 1000.00 } ] }
```

- **Valor contábil na baixa** = aquisição − acumulada até o mês **anterior** ao da baixa.
- **Ganho/perda é por OS**, porque o valor de venda é da OS inteira: venda = valor de venda − valor contábil (negativo = perda); baixa sem venda = −valor contábil (perda). Impostos e custos da venda não entram.
- `osId`/`osNumero` podem ser `null` em bens baixados antes das OS existirem (sem ganho/perda associado). Link "OS-000123" para o detalhe da OS quando houver.
- Em CSV/PDF o valor de venda e o ganho/perda aparecem **só na primeira linha de cada OS** (não duplica a soma); explicar isso na tela de exportação.
- `itens` é paginado; `ordens` e `totais` cobrem todo o intervalo.

## 5. Histórico e comparação em arquivo

Mesmos endpoints da spec 4.2 com `formato=csv|pdf` (sem `formato` ou `json` continua JSON):

- `GET /periodos/{mes}/historico?formato=csv|pdf` → arquivo `historico-depreciacao-2025-03.csv`: evento, revisão, usuário, data/hora, motivo, metodologia, totais, totais anteriores e variação.
- `GET /periodos/{mes}/comparar?de=1&para=2&formato=csv|pdf` → `comparacao-depreciacao-2025-03-rev1-rev2.csv`: por bem alterado, situação (alterado/incluído/removido), campos alterados e valores antes/depois.
- `404` se a competência/revisão não existe; `400` se `de == para` ou formato inválido.

Botões "Baixar CSV" e "Baixar PDF" na linha do tempo do período e na tela de comparação.

## Telas sugeridas (menu "Relatórios de depreciação")

1. **Razão do período**: seletor de mês fechado (usar `GET /periodos`), revisão (se houver mais de uma), agrupamento; tabela com totais fixos no rodapé; baixar CSV/PDF.
2. **Valor contábil**: data, filtros (categoria, local, responsável, status), cartões de totais, tabela paginada, aviso de bens com dados incompletos; baixar CSV/PDF.
3. **Bens por categoria/local/responsável/status**: seletor de dimensão e data, tabela e totais.
4. **Baixas e vendas**: período, resumo (quantidade, vendas, ganho/perda — verde/vermelho), tabela de bens e tabela de OS.
5. Em todas, rodapé com a **versão da metodologia** e link para a **Ajuda da depreciação** (novas seções *Relatórios*, *Glossário* e *O que o contador precisa validar*).

## Observações

- Valores `number` com 2 casas; não somar nem arredondar no front.
- Datas `yyyy-MM-dd`; competências sempre `yyyy-MM` na rota.
- Relatórios de dados atuais (valor contábil, por dimensão) podem diferir do razão se o cadastro mudou depois do fechamento — deixe claro na tela.
