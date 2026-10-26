# Contrato de sincronização — Imobilizado: contagem offline / app (Fase 2.6)

> Backend na branch `tbrt-imobilizado`. Sem migration nova (reaproveita o snapshot do esperado da `0019` e o envio em lote da `0020`).
> Destinatário principal: o futuro **app de contagem** (Flutter, fora de escopo agora). A web pode usar o mesmo contrato (ex.: contagem com a conexão instável).
> Esta fatia **documenta e fixa o contrato**; não há otimização de desempenho para mobile ainda (o pacote é enviado inteiro, sem delta).

---

## Fluxo

1. **Baixar o pacote** do inventário em andamento (escopo de locais + esperado).
2. **Contar offline**: o app guarda cada leitura localmente com um `clientId` (GUID gerado no aparelho) e o horário real da leitura.
3. **Enviar em lote** quando houver conexão. O envio é **idempotente por `clientId`**: reenviar o mesmo lote (queda de rede, timeout, retry) não duplica leituras.
4. Conferir o resultado em `GET .../conciliacao/resumo` ou `.../painel` (opcional no app).

Todas as chamadas exigem `Authorization: Bearer ...` e `X-Empresa-Id`. Quem pode: **equipe do inventário** (ou `admin`), com role `admin` ou `operador`. Operador fora da equipe → `403`; role `leitura` → `403`.

---

## 1. Baixar o pacote — `GET /v1/imobilizado/inventarios/{inventarioId}/sincronizacao/pacote`

Só para inventário `em_andamento` (rascunho/concluído/cancelado → `400`; inexistente ou de outra empresa → `404`).

```json
{
  "inventarioId": 7,
  "nome": "Inventário 2026",
  "status": "em_andamento",
  "dataInicio": "2026-10-20T12:00:00Z",
  "geradoEm": "2026-10-22T09:30:00Z",
  "maxLeiturasPorLote": 1000,
  "totalEsperados": 155,
  "locais": [
    { "id": 1, "nome": "Matriz", "codigo": null, "localPaiId": null, "ativo": true },
    { "id": 2, "nome": "Sala 101", "codigo": "S101", "localPaiId": 1, "ativo": true }
  ],
  "esperados": [
    { "bemId": 10, "plaqueta": "NB-001", "descricao": "Notebook Dell", "localId": 2 }
  ]
}
```

- **`locais`**: os locais escolhidos para o inventário **mais todos os sublocais**. Monte o seletor de local do app com isso (árvore por `localPaiId`). Leituras só são aceitas em locais `ativo: true`.
- **`esperados`**: o snapshot congelado ao iniciar o inventário (não muda mesmo que o cadastro mude). Serve para: mostrar "esperado neste local" durante a contagem, avisar na hora quando a plaqueta lida não é esperada ali, e exibir descrição. A decisão oficial (encontrado / divergente / sobra...) é sempre recalculada pelo servidor.
- Ordenação: `esperados` por plaqueta; `locais` por nome.
- Compare plaquetas **sem diferenciar maiúsculas/minúsculas** (igual ao servidor).
- Baixe de novo sempre que quiser (é seguro); `geradoEm` indica a foto. O esperado em si não muda durante o inventário, então um pacote baixado continua válido até o encerramento.

---

## 2. Enviar leituras em lote — `POST /v1/imobilizado/inventarios/{inventarioId}/leituras/lote`

(Endpoint já existente; descrito aqui como parte do contrato.)

```json
{
  "leituras": [
    { "clientId": "7b0c8d5e-...", "plaqueta": "NB-001", "localId": 2,
      "lidoEm": "2026-10-22T08:15:03-03:00", "observacao": "etiqueta rasgada" }
  ]
}
```

| Campo | Regra |
|---|---|
| `clientId` | **Obrigatório** no lote. GUID único por leitura, gerado no aparelho e guardado até o servidor confirmar. |
| `plaqueta` | Obrigatória, até 50 caracteres. Plaqueta que não existe no cadastro é aceita (vira "sobra"). |
| `localId` | Obrigatório; local ativo da empresa. |
| `lidoEm` | Horário real da leitura **com fuso**. Não pode estar no futuro nem antes do início do inventário. Omitido = momento do recebimento (evite: perde-se o horário real). |
| `observacao` | Opcional, até 2000. |

- Máximo **1000 leituras por chamada** (`maxLeiturasPorLote`); divida lotes maiores.
- Resposta `200` sempre que o lote foi processado, com resultado **por item** (um item inválido não derruba os demais):

```json
{ "criadas": 998, "reaproveitadas": 0, "comErro": 2,
  "itens": [ { "indice": 0, "clientId": "…", "status": "criada", "erro": null } ] }
```

- `status` por item: `criada`, `reaproveitada` (esse `clientId` já tinha sido recebido — considere sincronizada) ou erro com mensagem em `erro`.
- **Regra de ouro do app:** só apague/marque como sincronizada a leitura cujo item voltou `criada` ou `reaproveitada`. Itens com erro de validação (local inativo, data futura...) devem ficar visíveis ao usuário para correção.
- Falha de rede, `5xx` ou timeout: reenvie o mesmo lote com os mesmos `clientId` — é seguro.
- `400` no lote inteiro (ex.: inventário não está mais `em_andamento`, mais de 1000 itens): pare o envio e avise o usuário (inventário encerrado = leituras pendentes não serão mais aceitas; exportar do aparelho é com a gestão).
- `403`: usuário fora da equipe.

### Anulação

Leitura enviada por engano pode ser anulada na web (`DELETE .../leituras/{id}`, mesma regra de equipe). O app não precisa implementar anulação no primeiro momento.

---

## 3. Erros comuns

| Código | Quando | Ação sugerida no app |
|---|---|---|
| `401` | Token expirado | Renovar login; manter a fila local |
| `403` | Fora da equipe / role `leitura` / sem vínculo com a empresa | Avisar; não perder leituras |
| `404` | Inventário inexistente ou de outra empresa | Avisar; revisar o inventário selecionado |
| `400` | Regra violada (`{ "error": "…" }`) | Mostrar a mensagem |

---

## Decisões de contrato

- **Sem sincronização incremental (delta) por ora**: o pacote vai inteiro. Com milhares de bens ainda é leve (dezenas de KB por mil itens); revisar quando o app existir.
- **Sem versionamento do pacote**: como o esperado é imutável até o encerramento, basta o `geradoEm`.
- **Download de cadastro de bens completo não faz parte do contrato**: o app só precisa da plaqueta, descrição e local esperado.
- **Resolução de divergências é só na web** (fatia 2.4); o app apenas conta.
