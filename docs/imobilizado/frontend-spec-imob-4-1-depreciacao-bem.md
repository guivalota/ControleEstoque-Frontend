# Spec de Frontend — Imobilizado: Depreciação por bem e Ajuda (Fase 4.1)

> Backend na branch `tbrt-imobilizado` (migration `0027_imob_depreciacao_base`).
> Pré-requisitos: cadastro de bens (1.x), `X-Empresa-Id` e o histórico do bem (1.5).
> **Aviso de produto:** as regras são a proposta técnica do sistema e só valem para uso contábil real depois da validação de um contador (fatia 4.5). A tela deve exibir o aviso retornado pela API (`ajuda.aviso`).
> Esta fatia **não grava nada**: o cálculo é feito sob demanda. O fechamento mensal, com histórico e valores anteriores, vem na 4.2.

---

## Para que serve

Permitir que o **contador confira, no próprio sistema, como cada número é calculado**:

1. **Ajuda da depreciação** (FAQ): fórmulas, premissas, exemplos numéricos, em linguagem de contador, com a **versão da metodologia**.
2. **Depreciação do bem**: resumo, **memória de cálculo** (passo a passo com os números do bem) e cronograma mês a mês.

## 1. Depreciação do bem — `GET /v1/imobilizado/depreciacao/bens/{id}`

Header `X-Empresa-Id` obrigatório. Roles: `admin`, `operador`, `leitura`.

Query (todas opcionais):

| Parâmetro | Padrão | Descrição |
|---|---|---|
| `em` | hoje (São Paulo) | Data de referência `yyyy-MM-dd` (1900 a 2200; fora disso `400`) |
| `page` | 1 | Página do cronograma |
| `pageSize` | 50 | Máximo 100 (valores maiores são limitados a 100) |

Resposta `200`:

```json
{
  "bemId": 12, "plaqueta": "DP-1", "descricao": "Notebook", "status": "ativo",
  "metodologiaVersao": "1.0",
  "situacao": "calculada",
  "premissas": { "dataAquisicao": "2025-03-15", "valorAquisicao": 12000.00, "valorResidual": 1200.00, "vidaUtilMeses": 60, "dataBaixa": null },
  "resumo": {
    "baseDepreciavel": 10800.00, "quotaMensal": 180.00, "ultimaQuota": 180.00,
    "competenciaInicial": "2025-03-01", "competenciaFinalDaVida": "2030-02-01",
    "ultimaCompetenciaDepreciada": "2030-02-01", "totalQuotas": 60,
    "em": "2025-12-31", "quotasAteEm": 10, "acumuladaEm": 1800.00, "valorContabilEm": 10200.00,
    "totalmenteDepreciado": false
  },
  "memoriaDeCalculo": [
    { "numero": 2, "titulo": "Base depreciável", "regra": "base = valor de aquisição − valor residual",
      "calculo": "R$ 12.000,00 − R$ 1.200,00", "resultado": "R$ 10.800,00" }
  ],
  "cronograma": {
    "items": [ { "numero": 1, "competencia": "2025-03-01", "quota": 180.00, "acumulada": 180.00, "valorContabil": 11820.00 } ],
    "page": 1, "pageSize": 50, "total": 60
  }
}
```

- `situacao`: `"calculada"` ou `"dados_incompletos"`. Em `dados_incompletos` (bem sem data/valor de aquisição) `resumo` é `null`, `cronograma.items` é vazio e `memoriaDeCalculo` tem um passo explicando o que falta — mostrar um aviso com link para editar o bem.
- `totalmenteDepreciado`: `true` quando completou a vida útil e não foi baixado.
- `premissas.dataBaixa`: preenchida só para bens `baixado`/`vendido` (data da aprovação da OS, fuso de São Paulo). A depreciação para no **mês anterior**; o passo "Baixa ou venda" aparece na memória.
- `memoriaDeCalculo`: lista **já em texto pronto** (valores formatados em `R$ 1.234,56`, datas `dd/MM/yyyy`, meses `MM/yyyy`). Exibir como tabela/accordion: **Passo · Regra · Cálculo · Resultado**. Não recalcular no front.
- `cronograma`: valores numéricos (formatar no front). A última quota pode diferir das demais (absorve o arredondamento) — destacar a linha quando `quota` ≠ `resumo.quotaMensal`.

| Erro | Quando |
|---|---|
| `400` | `em` fora do intervalo |
| `401` | sem token |
| `403` | sem vínculo com a empresa do header |
| `404` | bem inexistente, excluído ou **de outra empresa** |

### Tela sugerida (aba "Depreciação" na página do bem)

1. Cartões: **Valor de aquisição**, **Depreciação acumulada**, **Valor contábil** (na data `em`), **Quota mensal**.
2. Seletor de data de referência (`em`), padrão hoje.
3. Seção **"Como foi calculado"** com a memória de cálculo e o selo **"Metodologia v{metodologiaVersao}"** + link "Ver ajuda".
4. Tabela do cronograma (paginada), com a competência da data de referência destacada.
5. Bem baixado/vendido: faixa informando a data da baixa e que o mês da baixa não deprecia.

## 2. Ajuda da depreciação (FAQ) — `GET /v1/imobilizado/depreciacao/ajuda`

Roles: `admin`, `operador`, `leitura`. **Não exige** `X-Empresa-Id` (conteúdo global).

Query: `q` (opcional) — filtra perguntas e respostas por texto, sem diferenciar maiúsculas e acentos (`depreciacao` encontra "depreciação"). Resposta sem resultado = `secoes: []`.

```json
{
  "versao": "1.0",
  "atualizadoEm": "2026-10-23",
  "aviso": "As regras abaixo são a proposta técnica do sistema…",
  "secoes": [
    { "slug": "como-calculamos", "titulo": "Como calculamos", "ordem": 1,
      "itens": [
        { "slug": "formulas", "pergunta": "Quais são as fórmulas?", "resposta": "- **Base depreciável** = …", "validarComContador": false }
      ] }
  ]
}
```

- `resposta` é **Markdown** (listas, negrito): renderizar com um parser Markdown **sem HTML cru**.
- `validarComContador: true` marca regras decididas por recomendação técnica que o contador precisa confirmar (início da depreciação, extravio, mês da baixa, arredondamento). Exibir um selo "Validar com o contador".
- Exibir `versao` e `atualizadoEm` ("Metodologia v1.0 — atualizada em 23/10/2026") e o `aviso` em destaque no topo.
- Os exemplos numéricos do texto são calculados pelo mesmo código do sistema; não precisam ser conferidos no front.

`GET /v1/imobilizado/depreciacao/ajuda/{slug}` devolve uma única seção (`404` se o slug não existe) — útil para links diretos, como `…/ajuda/arredondamento` a partir de um passo da memória de cálculo.

Seções desta fatia: `como-calculamos`, `inicio-e-fim`, `status-e-baixas`, `arredondamento`. As seções sobre fechamento, reabertura, auditoria e relatórios entram nas fatias 4.2 e 4.3; a tela deve renderizar o que a API devolver, sem lista fixa de seções.

### Tela sugerida ("Ajuda — Depreciação", item de menu do módulo)

- Campo de busca (chama `?q=` com debounce), índice lateral por seção, itens em accordion.
- Link "Ver memória de cálculo de um bem" levando à busca de bens.

## Observações

- Datas vêm como `yyyy-MM-dd`; competências são sempre o **dia 1** do mês.
- Valores são `number` com 2 casas; não somar/arredondar no front — use o que a API devolve.
- Tudo é calculado na hora: alterar o cadastro do bem (data, valores, vida útil) muda o resultado na próxima consulta. Só depois do fechamento (4.2) os números do período ficam congelados.
