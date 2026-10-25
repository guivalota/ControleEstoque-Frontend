# Spec de Frontend — Etiquetas patrimoniais com QR (5.2)

> Backend na branch `tbrt-imobilizado` (sem migration). Rotas com `X-Empresa-Id`; qualquer perfil (`admin`, `operador`, `leitura`) pode imprimir.

## O que a etiqueta tem

Um **QR** que contém **somente a plaqueta** (o mesmo valor que `GET /v1/imobilizado/bens/por-plaqueta?plaqueta=…` e a leitura do inventário aceitam), a plaqueta em texto grande, o nome da empresa, a descrição e o local do bem. Não há dados financeiros na etiqueta.

## 1. Modelos — `GET /v1/imobilizado/etiquetas/modelos`

```json
[
  { "codigo": "a4-21",      "descricao": "Folha A4, 21 etiquetas de 63,5 × 38,1 mm (3 × 7)",   "etiquetaLarguraMm": 63.5, "etiquetaAlturaMm": 38.1, "etiquetasPorPagina": 21 },
  { "codigo": "a4-65",      "descricao": "Folha A4, 65 etiquetas de 38,1 × 21,2 mm (5 × 13)",  "etiquetaLarguraMm": 38.1, "etiquetaAlturaMm": 21.2, "etiquetasPorPagina": 65 },
  { "codigo": "rolo-50x30", "descricao": "Rolo térmico, uma etiqueta de 50 × 30 mm por página", "etiquetaLarguraMm": 50,   "etiquetaAlturaMm": 30,   "etiquetasPorPagina": 1 }
]
```

Use para montar o seletor de modelo (padrão `a4-21`). Folhas A4 são impressas em **tamanho real** (100 %, sem "ajustar à página").

## 2. Gerar o PDF — `GET /v1/imobilizado/etiquetas`

Resposta `200 application/pdf` (`etiquetas.pdf`). **Baixe como blob pelo interceptor** (o header `X-Empresa-Id` não vai em link direto) e abra em nova aba ou baixe.

Query string:

| Parâmetro | Tipo | Observação |
|---|---|---|
| `ids` | inteiro, repetido (`ids=1&ids=2`) | Imprime exatamente esses bens. **Com `ids`, os filtros abaixo são ignorados.** |
| `modelo` | texto | `a4-21` (padrão), `a4-65`, `rolo-50x30` |
| `bordas` | bool | Desenha o contorno de cada etiqueta (para testar em papel comum). Padrão `false` |
| `busca`, `localId`, `incluirSublocais`, `categoriaId`, `responsavelId`, `status`, `dadosCompletos` | como na listagem de bens | Usados **sem `ids`**. `page`/`pageSize` são ignorados |

Ordem: por plaqueta. Máximo de **500 etiquetas** por pedido.

### Erros (`400`, `{ "error": "…" }`, mostrar a mensagem)

- `Modelo de etiqueta inválido…`
- `Nenhum bem encontrado para imprimir etiquetas.`
- `O limite é de 500 etiquetas por pedido…` (com `ids` ou com filtro — pedir para refinar os filtros)
- `Bem(ns) não encontrado(s): 12, 40.` — ids que não existem **na empresa ativa** (bem de outra empresa responde igual a inexistente).
- `Status inválido…`

## 3. Telas sugeridas

1. **Lista de bens**: seleção por checkbox + botão "Imprimir etiquetas" (envia `ids`); e "Imprimir etiquetas do filtro" (envia os filtros atuais, sem `ids`; avisar se o total passar de 500).
2. **Detalhe do bem**: botão "Imprimir etiqueta" (um `id`; sugerir `rolo-50x30` ou `a4-21`).
3. **Diálogo de impressão**: seletor de modelo (com `etiquetasPorPagina`), opção "Mostrar bordas", pré-visualização do PDF em `<iframe>`/nova aba, botão "Baixar".
4. Lembrar o usuário de imprimir a 100 % e de testar com `bordas=true` em papel comum antes de usar a folha adesiva.

## 4. Pontos de atenção

- Bens `baixado`/`vendido` também podem ser impressos (o filtro de `status` é do usuário).
- O QR é gerado no servidor; o front **não** precisa de biblioteca de QR.
- Para ler a etiqueta no app/inventário, use o valor lido como `plaqueta` (a busca ignora maiúsculas/minúsculas).
