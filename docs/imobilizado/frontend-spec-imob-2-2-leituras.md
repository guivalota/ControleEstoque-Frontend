# Spec de Frontend — Imobilizado: Leituras do inventário (Fase 2.2)

> Backend na branch `tbrt-imobilizado` (migration `0020_imob_leituras`).
> Pré-requisitos: `frontend-spec-imob-0b-empresas.md` (header `X-Empresa-Id`) e `frontend-spec-imob-2-1-inventarios.md`.
> A **conciliação** (comparar o lido com o esperado) está na spec 2.3.

---

## Visão geral

Uma **leitura** é o registro de que uma plaqueta foi vista fisicamente em um local, durante um inventário `em_andamento`. Pode vir de três origens: **web** (digitada/bipada na tela), **csv** (arquivo importado) ou **app** (envio em lote do futuro aplicativo).

Regras que valem para tudo:

- **Só com o inventário `em_andamento`.** Rascunho, concluído ou cancelado → `400`.
- **Quem pode registrar/importar/anular:** os usuários da **equipe** do inventário e **qualquer `admin`**. Um `operador` fora da equipe recebe **`403`** `{ "error": "Somente a equipe do inventário (ou um administrador) pode ..." }`. Role `leitura` → `403` (por papel). A consulta (`GET`) é liberada para `admin`, `operador` e `leitura`.
- Todos os endpoints exigem `X-Empresa-Id`. Inventário de outra empresa é indistinguível de inexistente (`404`).
- **Idempotência:** cada leitura tem um `clientId` (GUID). Reenviar o mesmo `clientId` no mesmo inventário **não duplica** — devolve a leitura original. Isso torna seguro repetir uma requisição que deu timeout ou reenviar um lote offline.
- O servidor **não exige** que a plaqueta exista nem que esteja no local esperado: leituras "estranhas" são justamente o que a conciliação classifica depois (sobra, local divergente...).
- Leitura **não é editável**: se foi um engano, **anule** e registre outra.

Base: `/v1/imobilizado/inventarios/{inventarioId}/leituras`.

---

## 1. Registrar uma leitura — `POST .../leituras`

```json
{ "plaqueta": "NB-0001", "localId": 7, "lidoEm": "2026-10-22T11:30:00-03:00", "clientId": "5b8f…", "observacao": "sem etiqueta legível" }
```

| Campo | Regra |
|---|---|
| `plaqueta` | Obrigatória, máx. 50; espaços nas pontas removidos; sem diferenciar maiúsculas na conciliação |
| `localId` | Obrigatório; **local ativo da empresa** onde a plaqueta foi lida (pode ser qualquer local ativo — também fora do escopo) |
| `lidoEm` | Opcional (com fuso). Omitido = agora. Não pode estar no futuro (tolerância de 5 min) nem antes do início do inventário (tolerância de 5 min). Guardado em UTC |
| `clientId` | Opcional na web (o servidor gera); **informe sempre que puder** (gere um GUID por leitura no cliente) para ter retry seguro |
| `observacao` | Opcional, máx. 2000 |

Resposta: **`201`** quando criou, **`200`** quando o `clientId` já existia (`reaproveitada: true`, nada novo foi gravado). Se o `clientId` já foi usado por **outra** plaqueta/local → `400`.

```json
{
  "id": 1234, "clientId": "5b8f…", "plaqueta": "NB-0001",
  "localLidoId": 7, "localLidoNome": "Sala 101",
  "usuarioId": "3f2b…", "usuarioNome": "Carlos Contador",
  "lidoEm": "2026-10-22T14:30:00Z", "origem": "web", "observacao": null, "criadoEm": "2026-10-22T14:31:02Z",
  "anulada": false,
  "reaproveitada": false,
  "info": {
    "plaqueta": "NB-0001", "noEsperado": true, "bemId": 42, "descricao": "Notebook Dell Latitude",
    "localEsperadoId": 7, "localEsperadoNome": "Sala 101", "leiturasAtivas": 1,
    "situacaoPrevista": "no_local_esperado"
  }
}
```

### `info.situacaoPrevista` — feedback imediato para quem está bipando

| Valor | Significado | Sugestão de UI |
|---|---|---|
| `no_local_esperado` | Está no esperado e foi lida onde deveria | ✔ verde |
| `em_outro_local` | Está no esperado, mas o local esperado é outro (`localEsperadoNome`) | ⚠ amarelo: "esperado em Filial" |
| `fora_do_esperado` | O bem existe no cadastro, mas não estava no esperado deste inventário (outro escopo, status baixado/extraviado, cadastrado depois do início) | ⚠ laranja |
| `plaqueta_desconhecida` | Não existe bem com essa plaqueta na empresa | ✖ vermelho: "plaqueta não cadastrada" |

`leiturasAtivas > 1` indica que a plaqueta já tinha sido lida antes (leitura repetida) — avise sem bloquear.

## 2. Consultar a plaqueta antes de registrar — `GET .../leituras/info?plaqueta=NB-0001`

Mesma estrutura de `info` (sem `situacaoPrevista`): mostra a descrição do bem, o local esperado e quantas vezes já foi lida, **sem gravar nada**. Útil para a tela de bipagem confirmar "é este item?" antes de gravar.

## 3. Listar — `GET .../leituras`

| Query | Tipo | Descrição |
|---|---|---|
| `plaqueta` | `string` | Contém, sem diferenciar maiúsculas |
| `localId` | `number` | Local onde foi lida |
| `usuarioId` | `guid` | Quem leu |
| `incluirAnuladas` | `bool` | Padrão `false` |
| `page` / `pageSize` | `number` | Padrão 1 / 50; **máximo 100** |

Mais recentes primeiro (`lidoEm` decrescente). Itens no formato da resposta acima (sem `info`). `GET .../leituras/{id}` devolve uma leitura (`404` se não existir nesta empresa/inventário). `404` na listagem se o inventário não existir.

## 4. Anular — `DELETE .../leituras/{id}`

`204`. Anulação **lógica** (a leitura fica visível com `incluirAnuladas=true`, marcada `anulada: true`) e só com o inventário em andamento. Anular de novo → `400`. Reenviar o mesmo `clientId` depois de anular **não** reativa a leitura (registre uma nova com outro `clientId`).

## 5. Envio em lote (app / sincronização) — `POST .../leituras/lote`

```json
{ "leituras": [ { "clientId": "…", "plaqueta": "NB-0001", "localId": 7, "lidoEm": "2026-10-22T11:30:00-03:00" } ] }
```

- **Até 1000** leituras por chamada; `clientId` **obrigatório** em cada uma. Origem gravada como `app`.
- Itens inválidos **não derrubam** os válidos: a resposta traz o resultado por item.

```json
{
  "criadas": 2, "reaproveitadas": 1, "comErro": 1,
  "itens": [
    { "indice": 0, "clientId": "…", "status": "criada" },
    { "indice": 1, "clientId": "…", "status": "reaproveitada" },
    { "indice": 2, "clientId": "…", "status": "erro", "erro": "Local com id 999 não encontrado." },
    { "indice": 3, "clientId": "…", "status": "criada" }
  ]
}
```

O app deve marcar como sincronizadas as leituras `criada` **e** `reaproveitada`; as `erro` precisam de correção/descartar. É o contrato base do futuro app offline (fatia 2.6).

## 6. Importar CSV — modelo, validar e importar

- **Modelo:** `GET .../leituras/importacao/modelo` (`modelo-importacao-leituras.csv`, UTF-8 com BOM). Baixe via `HttpClient` com `responseType: 'blob'`.
- **Importar:** `POST .../leituras/importacao` — `multipart/form-data` com `arquivo` (obrigatório), `localPadraoId` (opcional) e `apenasValidar` (opcional; `true` = só valida e relata, sem gravar).

| Coluna | Obrig. | Regra |
|---|---|---|
| `plaqueta` | sim | Máx. 50 |
| `local` | não* | **Código** (preferido) ou **nome** do local; nome repetido em mais de um local exige o código. Vazio → usa o **local padrão**; sem padrão e sem coluna `local` → `400` |
| `lido_em` | não | `dd/MM/yyyy HH:mm[:ss]`, `dd.MM.yyyy HH:mm`, `yyyy-MM-dd HH:mm[:ss]` ou ISO 8601 com fuso (`…Z`, `…-03:00`). **Sem fuso = horário de Brasília (UTC-3).** Data sem hora é inválida. Omitido = momento da importação |
| `client_id` | não | GUID. Omitido: o servidor deriva um id estável do conteúdo da linha (inventário + plaqueta + local + data/hora + observação) |
| `observacao` | não | Máx. 2000 |

Apelidos de cabeçalho: `placa`, `departamento` (→ local), `data_hora`/`data_leitura`, `obs`. Colunas desconhecidas são ignoradas e listadas. Delimitador `;`, `,` ou tab; UTF-8 ou Windows-1252; só CSV (`.xlsx`/`.xlsm` → `400`); **5 MB / 20.000 linhas**.

Diferente da importação de bens, aqui **linhas válidas são gravadas e as com erro são relatadas e ignoradas** (leituras são pequenas, anuláveis e reimportáveis sem duplicar). Resposta `200`:

```json
{
  "somenteValidacao": false, "totalLinhas": 120, "linhasValidas": 118, "linhasComErro": 2,
  "importadas": 118, "jaExistentes": 0,
  "totalErros": 2, "errosTruncados": false,
  "erros": [ { "linha": 15, "plaqueta": "NB-77", "campo": "local", "mensagem": "Local 'Filial Norte' não encontrado." } ],
  "colunasIgnoradas": []
}
```

**Reimportar o mesmo arquivo é seguro**: as linhas já gravadas voltam em `jaExistentes` e nada duplica. Cuidado: sem `lido_em` e sem `client_id`, duas linhas idênticas (mesma plaqueta, local e observação) valem **uma** leitura.

Erros `400` (`{ "error": "..." }`): inventário fora de andamento, aspas não fechadas ("Aspas não fechadas na linha N…"), colunas ausentes, local padrão inválido, arquivo grande/Excel.

---

## 7. Sugestão de UI

**Tela de contagem (web/tablet):** seletor de **local atual** fixo no topo ("Estou em: Sala 101"), campo de plaqueta com foco permanente (leitor de código de barras envia Enter), e a cada leitura:

```
✔ NB-0001  Notebook Dell Latitude — esperado aqui                      [anular]
⚠ MS-0002  Mesa de reunião — esperada em "Filial"
✖ 99999    plaqueta não cadastrada
```

- Gere o `clientId` no cliente a cada leitura e reenvie o mesmo em caso de falha de rede.
- Mostre o contador de leituras da sessão e um histórico com "anular".
- Bloqueie a tela se o usuário não for da equipe (ou ofereça "pedir inclusão na equipe": o `admin` edita a equipe em `PUT inventarios/{id}`, spec 2.1).
- Tela de importação: baixar modelo → escolher arquivo/local padrão → "Validar" (`apenasValidar=true`) → relatório → "Importar".

## 8. Tipos TypeScript

```typescript
export type SituacaoPrevista = 'no_local_esperado' | 'em_outro_local' | 'fora_do_esperado' | 'plaqueta_desconhecida';

export interface ImobLeituraInfo {
  plaqueta: string; noEsperado: boolean; bemId?: number | null; descricao?: string | null;
  localEsperadoId?: number | null; localEsperadoNome?: string | null; leiturasAtivas: number;
  situacaoPrevista?: SituacaoPrevista | null;
}

export interface ImobLeitura {
  id: number; clientId: string; plaqueta: string; localLidoId: number; localLidoNome: string;
  usuarioId: string; usuarioNome?: string | null; lidoEm: string; origem: 'web' | 'csv' | 'app';
  observacao?: string | null; criadoEm: string; anulada: boolean;
}

export interface ImobLeituraRegistrada extends ImobLeitura { reaproveitada: boolean; info: ImobLeituraInfo; }

export interface RegistrarImobLeitura {
  plaqueta: string; localId: number; lidoEm?: string; clientId?: string; observacao?: string;
}

export interface ResultadoLote {
  criadas: number; reaproveitadas: number; comErro: number;
  itens: { indice: number; clientId?: string | null; status: 'criada' | 'reaproveitada' | 'erro'; erro?: string | null }[];
}

export interface RelatorioImportacaoLeituras {
  somenteValidacao: boolean; totalLinhas: number; linhasValidas: number; linhasComErro: number;
  importadas: number; jaExistentes: number; totalErros: number; errosTruncados: boolean;
  erros: { linha: number; plaqueta?: string | null; campo: string; mensagem: string }[];
  colunasIgnoradas: string[];
}
```

## 9. Fora desta fatia

Conciliação e painel de progresso (2.3/2.4), correção de divergências (2.4), encerramento do inventário (2.5) e o desenho de sincronização incremental com cursor para o app (2.6; o `lote` acima já é a base do envio).
