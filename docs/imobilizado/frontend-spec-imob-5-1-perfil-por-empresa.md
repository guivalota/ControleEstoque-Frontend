# Spec de Frontend — Perfil de acesso por empresa (5.1)

> Backend na branch `tbrt-imobilizado` (migration `0030_imob_perfil_empresa`). Desenho: `DESENHO_FASE_5_PERFIL_POR_EMPRESA.md`.

## Regra em uma frase

O usuário tem uma **role global** (`admin`, `operador`, `leitura`) e, em cada empresa, um **perfil**. O que vale é o **perfil efetivo** = o **menor** dos dois (`admin` > `operador` > `leitura`). O perfil só **restringe**: nunca dá mais poder que a role global. O `admin` global (administrador da plataforma) é **sempre admin** em qualquer empresa.

| Role global | Perfil na empresa | Efetivo |
|---|---|---|
| operador | leitura | leitura |
| operador | admin | operador |
| leitura | operador | leitura |
| admin | qualquer | admin |

## 1. Seletor de empresa e empresa ativa

`GET /v1/imobilizado/minhas-empresas` (sem `X-Empresa-Id`) — cada empresa ganha `perfil` (**o efetivo**):

```json
[{ "id": 4, "razaoSocial": "Matriz Ltda", "nomeFantasia": "Matriz", "cnpj": "…", "ativo": true, "criadoEm": "…", "perfil": "leitura" }]
```

`GET /v1/imobilizado/empresa-ativa` (com `X-Empresa-Id`) devolve o mesmo formato, com o `perfil` efetivo naquela empresa.

**O que fazer no front**
- Guardar o `perfil` da empresa selecionada e **trocar ao trocar de empresa** (o mesmo usuário pode ser `operador` numa e `leitura` noutra).
- Mostrar o perfil no seletor (ex.: selo "Somente leitura").
- Esconder/desabilitar por perfil **efetivo** (não pela role global): `leitura` → sem botões de criar/editar/excluir/importar/abrir OS/registrar leitura; `operador` → sem ações de `admin` (aprovar OS, fechar/reabrir depreciação, excluir cadastros).
- Ações de plataforma (empresas, vínculos, usuários) continuam pela **role global** `admin`.

## 2. Erro 403 por perfil

Qualquer chamada com `X-Empresa-Id` pode voltar:

```json
{ "error": "Seu perfil nesta empresa (leitura) não permite esta ação." }
```

Diferente de `"Sem acesso à empresa informada."` (sem vínculo, empresa inativa ou inexistente). Tratar os dois como 403: o primeiro mostra o aviso e mantém a tela; o segundo leva ao seletor de empresa. Mostrar a mensagem do servidor.

## 3. Tela de vínculos (só `admin` da plataforma, sem `X-Empresa-Id`)

`GET /v1/imobilizado/empresas/{id}/usuarios` — cada item ganha:

| Campo | Significado |
|---|---|
| `role` | role global do usuário (teto) |
| `perfil` | perfil gravado no vínculo |
| `perfilEfetivo` | o que vale de fato |

Se `perfil` ≠ `perfilEfetivo` (ex.: a role global foi rebaixada depois), mostrar o efetivo e um aviso discreto ("perfil gravado: operador").

`POST /v1/imobilizado/empresas/{id}/usuarios` — corpo `{ "usuarioId": "…", "perfil": "leitura" }`. `perfil` é **opcional** (omitido = a role global do usuário). Reativar um vínculo desativado grava o perfil informado.

`PUT /v1/imobilizado/empresas/{id}/usuarios/{usuarioId}` — corpo `{ "perfil": "operador" }` → `204`. Só vínculo **ativo**. Vale **imediatamente** na instância que atendeu a chamada; em outra instância pode levar até 30 s.

**Validações (HTTP 400, `{ "error": "…" }`)**
- Perfil fora de `admin|operador|leitura`.
- Perfil maior que a role global: "O perfil 'operador' excede a role global do usuário ('leitura')…". Dica de UX: no seletor de perfil, desabilitar as opções acima da role global (`role` vem na listagem; no cadastro use a role do usuário escolhido).
- `PUT` de usuário sem vínculo ativo naquela empresa.

`403` para `operador`/`leitura` globais em qualquer rota de vínculos.

## 4. Pontos de atenção

- Mudar a role global do usuário (tela de usuários) muda o efetivo em **todas** as empresas, sem tocar nos vínculos.
- Admin global: o `perfil` gravado é ignorado (mostrar "Administrador da plataforma").
- A auditoria de acesso (`/v1/audit-logs`) registra o `PUT` de perfil; não há trilha própria de "quem mudou o perfil de quem" (melhoria futura).
