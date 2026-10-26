# Spec de Frontend — Imobilizado: Importação de bens por CSV (Fase 1.6)

> Backend na branch `tbrt-imobilizado` (migrations `0017_imob_bens_dados_pendentes` e `0018_imob_importacao_bens`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (header `X-Empresa-Id`), specs 1.1–1.5 (cadastros-base e bens).

---

## Visão geral

Importa muitos bens de uma vez a partir de um **CSV**, em **dois passos**: primeiro **validar** (não grava nada e mostra um relatório linha a linha), depois **confirmar** (grava). É **tudo-ou-nada** por padrão: se houver qualquer erro, nada é importado.

- Roles: `admin` e `operador` (em todos os endpoints desta spec, inclusive o modelo). `leitura` → `403`.
- Exige `X-Empresa-Id` (interceptor da spec 0B). A importação só enxerga categorias, locais, responsáveis e plaquetas **da empresa ativa**.
- Limites: **5 MB** e **20.000 linhas** por arquivo.
- **Só CSV.** Planilhas `.xlsx`/`.xlsm` são recusadas (`400`) com orientação para exportar como CSV.
- Não há atualização em massa: uma plaqueta que já existe na empresa é **erro** (não sobrescreve).
- Bens sem data **ou** sem valor de aquisição entram como **"dados incompletos"** (ver spec 1.4) e ficam fora da depreciação até serem completados.

---

## 1. Fluxo da tela

```
[1. Baixar modelo]  →  [2. Escolher arquivo + local padrão]  →  [3. Validar]  →  relatório
                                                                            ├─ sem erros → [4. Confirmar importação]
                                                                            └─ com erros → corrigir o arquivo e validar de novo
                                                                                          (ou "Importar só as válidas")
```

1. **Modelo:** botão "Baixar modelo" → `GET /v1/imobilizado/bens/importacao/modelo`.
2. **Seleção:** campo de arquivo (aceitar `.csv`) e seletor opcional de **Local padrão** (árvore de locais ativos).
3. **Validar:** `POST .../validar` com `multipart/form-data`. Mostrar o relatório (seção 4).
4. **Confirmar:** habilitado só se `podeConfirmar` for `true`. Reenvia o **mesmo arquivo** com o `hashArquivo` do passo 3 (guarde o `File` em memória; não peça de novo).

> O servidor **não guarda o arquivo** entre os passos: a confirmação revalida tudo. Por isso o `hashArquivo` é obrigatório: se o arquivo mudou entre validar e confirmar, a API recusa (`400`).

---

## 2. Layout do CSV

Delimitador `;`, `,` ou tab (detectado pelo cabeçalho), UTF-8 (com ou sem BOM) **ou Windows-1252** (o "CSV" padrão do Excel em português). Primeira linha = cabeçalho. Linhas totalmente vazias são ignoradas. Campos com `;`, aspas ou quebra de linha devem vir entre aspas (`"..."`, aspas internas duplicadas).

| Coluna | Obrig. | Regra |
|---|---|---|
| `plaqueta` | sim | Máx. 50. Única na empresa e **no arquivo**, sem diferenciar maiúsculas |
| `descricao` | sim | Máx. 500 |
| `categoria` | sim | **Nome** de uma categoria **ativa** existente (sem diferenciar maiúsculas/acentos: "informatica" = "Informática") |
| `local` | não* | **Código** (preferido) ou **nome** do local. Nome repetido em mais de um local → use o código. Vazio → usa o **Local padrão**; sem padrão → erro |
| `responsavel_matricula` | não | Matrícula de um responsável **ativo** |
| `data_aquisicao` | não | `dd/MM/yyyy`, `dd.MM.yyyy` ou `yyyy-MM-dd`; entre 01/01/1900 e hoje |
| `valor_aquisicao` | não | `1234.56`, `1234,56` ou `1.234,56` (aceita prefixo `R$`). ≥ 0 |
| `valor_residual` | não | Omitido → % residual da categoria × valor. Só com `valor_aquisicao`; ≤ valor |
| `vida_util_meses` | não | Inteiro 1–1200. Omitido → vida útil da categoria |
| `fornecedor` | não | Texto livre, máx. 255 |
| `documento` | não | Nº da NF/documento de aquisição, máx. 100 |
| `numero_serie` | não | Máx. 100 |
| `observacao` | não | Máx. 2000 |

Apelidos de cabeçalho aceitos (úteis para planilhas já existentes): `placa`, `plano de contas`, `departamento` (→ local), `data da compra`, `valor histórico`, `nf`, `série`, `obs`. Colunas desconhecidas são **ignoradas** e listadas em `colunasIgnoradas` (aviso, não erro). Os cabeçalhos `plaqueta`, `descricao` e `categoria` são obrigatórios; sem eles → `400` listando os que faltam.

Notas:
- Um ponto sozinho é decimal: `1.234` = 1,234 (use `1234` ou `1.234,00` para mil duzentos e trinta e quatro).
- O status do bem é sempre `ativo`; não há coluna de status.
- Como exportar do Excel: *Arquivo → Salvar como → CSV (separado por vírgulas/ponto e vírgula)*. Não envie `.xlsx`/`.xlsm`.

---

## 3. Endpoints

Todos com `X-Empresa-Id`. Os dois `POST` são `multipart/form-data`.

### 3.1 Modelo — `GET /v1/imobilizado/bens/importacao/modelo`
Baixa `modelo-importacao-bens.csv` (cabeçalho + uma linha de exemplo, UTF-8 com BOM, delimitador `;`). Baixe via `HttpClient` com `responseType: 'blob'` (o header de empresa impede `<a href>`).

### 3.2 Validar — `POST /v1/imobilizado/bens/importacao/validar`

| Campo do form | Tipo | |
|---|---|---|
| `arquivo` | arquivo | obrigatório |
| `localPadraoId` | número | opcional; local ativo da empresa. Inexistente/inativo/de outra empresa → `400` |

Resposta `200` (**sempre** `200` quando o arquivo foi lido, mesmo com erros de linha):

```json
{
  "totalLinhas": 155,
  "linhasValidas": 150,
  "linhasComErro": 5,
  "linhasComDadosIncompletos": 128,
  "totalErros": 6,
  "errosTruncados": false,
  "erros": [
    { "linha": 12, "plaqueta": "6369", "campo": "categoria", "mensagem": "Categoria 'Veículos' não encontrada (ou inativa)." },
    { "linha": 40, "plaqueta": "1301", "campo": "plaqueta", "mensagem": "Plaqueta duplicada no arquivo (primeira ocorrência na linha 8)." }
  ],
  "categoriasNaoEncontradas": [ { "nome": "Veículos", "linhas": 3 } ],
  "locaisNaoEncontrados":    [ { "nome": "Filial Norte", "linhas": 2 } ],
  "colunasIgnoradas": ["estado_do_bem"],
  "hashArquivo": "9f2c…(64 hex)",
  "podeConfirmar": false
}
```

- `linha` = número da linha **no arquivo** (o cabeçalho é a linha 1), igual ao que o usuário vê no editor/Excel.
- `campo` = nome canônico da coluna (`plaqueta`, `descricao`, `categoria`, `local`, `responsavel_matricula`, `data_aquisicao`, `valor_aquisicao`, `valor_residual`, `vida_util_meses`, `fornecedor`, `documento`, `numero_serie`, `observacao`) ou `linha` (problema geral da linha, ex.: colunas a mais).
- Uma linha pode ter vários erros (um item por campo). `linhasComErro` conta linhas, `totalErros` conta itens.
- Só os **primeiros 500** erros vêm em `erros`; `errosTruncados: true` indica que há mais (`totalErros` é o total real).
- `categoriasNaoEncontradas` / `locaisNaoEncontrados` agregam por nome — mostre como "ações sugeridas" (ex.: "Criar categoria 'Veículos'" levando ao cadastro; o importador **não cria** categorias nem locais sozinho).
- `podeConfirmar` = sem erros e com ao menos uma linha válida.

Erros `400` (arquivo inteiro, `{ "error": "..." }`): arquivo vazio/sem linhas, acima de 5 MB/20.000 linhas, extensão ou conteúdo de Excel, colunas obrigatórias ausentes, **aspas não fechadas** ("Aspas não fechadas na linha N…" — acontece quando um campo começa com `"` e não termina), local padrão inválido.

### 3.3 Confirmar — `POST /v1/imobilizado/bens/importacao/confirmar`

| Campo do form | Tipo | |
|---|---|---|
| `arquivo` | arquivo | **o mesmo** da validação |
| `localPadraoId` | número | o mesmo da validação |
| `hashArquivo` | texto | obrigatório: o `hashArquivo` devolvido pela validação |
| `importarApenasValidas` | bool | opcional (`true`): importa as linhas válidas e ignora as com erro |

Resposta `200`:

```json
{ "importados": 155, "ignoradas": 0, "relatorio": { /* mesmo formato da validação */ } }
```

Erros `400` (`{ "error": "..." }`):
- "O arquivo enviado difere do arquivo validado…" → hash ausente/diferente: volte ao passo de validação.
- "O arquivo possui N linha(s) com erro e nada foi importado…" → há erros e `importarApenasValidas` não foi marcado.
- "Nenhuma linha válida para importar."
- "Alguma plaqueta foi cadastrada por outra pessoa durante a importação. Nada foi gravado: valide o arquivo novamente." → conflito de concorrência; **nada** é gravado (a importação é uma única transação).

Cada bem importado ganha a entrada `criacao` no histórico (spec 1.5), com o usuário que confirmou.

---

## 4. Sugestão de UI

```
┌─ Importar bens (CSV) ───────────────────────────────────────────────┐
│ 1. [⭳ Baixar modelo]                                               │
│ 2. Arquivo: [Escolher…  bens.csv]   Local padrão: [A classificar ▾]  │
│                                       [Validar arquivo]              │
├──────────────────────────────────────────────────────────────────────┤
│ Resultado:  155 linhas · 150 válidas · 5 com erro · 128 incompletas  │
│ ⚠ 128 bens ficarão com "dados incompletos" (sem data ou valor).      │
│ Categorias não encontradas: Veículos (3 linhas)  [Criar categoria]   │
│ ┌ Linha  Plaqueta  Campo       Mensagem ────────────────────────┐    │
│ │ 12     6369      categoria   Categoria 'Veículos' não enc…   │    │
│ │ 40     1301      plaqueta    Plaqueta duplicada no arquivo…  │    │
│ └──────────────────────────────────────────────────────────────┘    │
│ [Importar 155 bens]   (desabilitado se houver erros)                 │
│ [Importar só as 150 válidas]  (secundário, com confirmação)          │
└──────────────────────────────────────────────────────────────────────┘
```

- Tabela de erros paginada no cliente, com filtro por campo e "baixar relatório de erros (CSV)" gerado no navegador.
- Se `errosTruncados`, avisar "mostrando os primeiros 500 de N erros".
- Trocar o arquivo ou o local padrão **invalida** o relatório atual (limpe o resultado e o hash).
- Durante a confirmação mostrar indicador de progresso e desabilitar o botão (importar milhares de linhas leva alguns segundos).
- Depois do sucesso: mensagem "N bens importados" e atalhos para a lista de bens (`?dadosCompletos=false` quando houver incompletos).
- Em `403` aplique o tratamento padrão da spec 0B; em `400` com `error`, exiba a mensagem.

## 5. Envio no Angular (exemplo)

```typescript
validar(arquivo: File, localPadraoId?: number) {
  const form = new FormData();
  form.append('arquivo', arquivo, arquivo.name);
  if (localPadraoId != null) form.append('localPadraoId', String(localPadraoId));
  return this.http.post<RelatorioImportacao>('/v1/imobilizado/bens/importacao/validar', form);
}

confirmar(arquivo: File, hash: string, localPadraoId?: number, apenasValidas = false) {
  const form = new FormData();
  form.append('arquivo', arquivo, arquivo.name);
  form.append('hashArquivo', hash);
  if (localPadraoId != null) form.append('localPadraoId', String(localPadraoId));
  if (apenasValidas) form.append('importarApenasValidas', 'true');
  return this.http.post<ResultadoImportacao>('/v1/imobilizado/bens/importacao/confirmar', form);
}
```
Não defina `Content-Type` manualmente (o navegador inclui o `boundary`). O interceptor da spec 0B adiciona o `X-Empresa-Id`.

## 6. Tipos TypeScript

```typescript
export interface ErroImportacao { linha: number; plaqueta?: string | null; campo: string; mensagem: string; }
export interface PendenciaImportacao { nome: string; linhas: number; }

export interface RelatorioImportacao {
  totalLinhas: number; linhasValidas: number; linhasComErro: number; linhasComDadosIncompletos: number;
  totalErros: number; errosTruncados: boolean; erros: ErroImportacao[];
  categoriasNaoEncontradas: PendenciaImportacao[]; locaisNaoEncontrados: PendenciaImportacao[];
  colunasIgnoradas: string[]; hashArquivo: string; podeConfirmar: boolean;
}

export interface ResultadoImportacao { importados: number; ignoradas: number; relatorio: RelatorioImportacao; }
```

## 7. Fora desta fatia

Importação direta de `.xlsx`, atualização em massa de bens existentes, criação automática de categorias/locais/responsáveis, e processamento em segundo plano com acompanhamento de progresso (hoje 10 mil bens gravam em menos de 1 segundo no banco; o tempo total depende do upload).
