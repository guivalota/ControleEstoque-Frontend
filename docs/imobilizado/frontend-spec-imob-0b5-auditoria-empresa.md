# Spec de Frontend — Auditoria com a empresa ativa (0B.5)

> Backend na branch `tbrt-imobilizado` (migration `0029_imob_audit_empresa`). Só `admin` da plataforma acessa.
> Nenhuma tela é obrigatória; se já existir uma tela de auditoria (Estoque), estas são as mudanças.

## `GET /v1/audit-logs`

Novo filtro opcional: `empresaId` (inteiro). Sem ele, o comportamento anterior continua (todos os registros).

Cada item ganha dois campos:

```json
{ "id": 981, "usuarioId": "…", "usuarioNome": "Maria", "endpoint": "/v1/imobilizado/bens", "method": "GET",
  "recursoId": null, "ip": "10.0.0.5", "criadoEm": "2026-10-23T15:00:00Z",
  "empresaId": 4, "empresaNome": "Matriz Ltda" }
```

- `empresaId` / `empresaNome` são **nulos** para ações do Estoque, rotas de plataforma (empresas, vínculos, usuários), acessos negados (`400`/`403`) e registros anteriores a esta versão. Mostrar "—" (ou "Plataforma/Estoque").
- `empresaNome` é o nome fantasia ou, se não houver, a razão social.
- A empresa registrada é a **validada** pelo servidor (vínculo ativo). Uma tentativa de usar uma empresa sem vínculo não aparece na auditoria dessa empresa.
- Sugestão: filtro "Empresa" (lista de `GET /v1/imobilizado/empresas`) e coluna "Empresa" na tabela.
- Este log é de **acesso** (quem chamou o quê). Para "o que mudou" use os históricos do bem, da OS e da depreciação.
