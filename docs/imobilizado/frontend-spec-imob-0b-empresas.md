# Spec de Frontend — Imobilizado: Multiempresa (Fase 0B)

> Backend na branch `tbrt-imobilizado` (migration `0012_imob_empresas`).
> Esta é a base de toda a área "Imobilizado": nenhuma tela de dados do módulo funciona sem uma **empresa ativa**.
> Docs relacionados: `frontend-spec-v1.8.md` (estilo), `PLANO_DE_ACAO.md` (decisões D12–D15).

---

## Visão geral

- Um usuário pode estar vinculado a **uma ou mais empresas**. Em cada chamada de dados do módulo o frontend informa a empresa ativa no header **`X-Empresa-Id`**.
- O servidor valida **toda requisição** contra o vínculo do usuário. O header nunca é confiável por si só.
- O JWT e o login **não mudam**: trocar de empresa não exige novo login.
- Empresas e vínculos são administrados somente por `admin` (administrador da plataforma). Não há "perfil por empresa" ainda: vale a role global (`admin`/`operador`/`leitura`).
- **Importante:** o `admin` também precisa estar vinculado a uma empresa para acessar dados dela. Quem cria uma empresa deve se vincular (ou vincular outro usuário) em seguida.

---

## 1. Minhas empresas — `GET /v1/imobilizado/minhas-empresas`

**Roles:** `admin`, `operador`, `leitura` · **Não** envia `X-Empresa-Id`.

Retorna apenas empresas **ativas** às quais o usuário tem vínculo **ativo**.

```json
[
  {
    "id": 1,
    "razaoSocial": "Indústria Alfa Ltda",
    "nomeFantasia": "Alfa",
    "cnpj": "11222333000181",
    "ativo": true,
    "criadoEm": "2026-10-22T14:03:11Z"
  }
]
```

Lista vazia = usuário sem vínculo (ver estados da UI abaixo).

## 2. Empresa ativa — `GET /v1/imobilizado/empresa-ativa`

**Roles:** `admin`, `operador`, `leitura` · **Exige** `X-Empresa-Id`.

Devolve a empresa do header, depois de validar o vínculo. Use para confirmar a seleção restaurada do `localStorage` (a empresa pode ter sido desativada ou o usuário desvinculado desde a última visita).

| Status | Quando | Corpo |
|---|---|---|
| `200` | Header válido e com vínculo | `ImobEmpresaResponse` |
| `400` | Header ausente ou não numérico/≤ 0 | `{ "error": "Header X-Empresa-Id ausente ou inválido." }` |
| `403` | Empresa inexistente, inativa, removida **ou** sem vínculo (mesma resposta para todos os casos) | `{ "error": "Sem acesso à empresa informada." }` |
| `401` | Sem token / token inválido | — |

---

## 3. Contrato do header (vale para todas as fatias seguintes)

Todo endpoint `v1/imobilizado/...` **de dados** (locais, bens, inventários...) exige `X-Empresa-Id`. Exceções, que **não** usam o header: `minhas-empresas` e a administração `v1/imobilizado/empresas/**`.

- O frontend **nunca** envia `empresaId` no corpo ou na query; só o header.
- `400` por header ausente = bug do cliente (interceptor não aplicou). `403` = perdeu o acesso: ver tratamento abaixo.
- O vínculo é cacheado por até ~30 s no servidor, mas **desvincular, desativar ou excluir empresa invalida imediatamente**.

### Interceptor Angular (sugestão)

```typescript
export const empresaInterceptor: HttpInterceptorFn = (req, next) => {
  const empresa = inject(EmpresaAtivaService);
  const ehDadosImob =
    req.url.includes('/v1/imobilizado/') &&
    !req.url.includes('/v1/imobilizado/minhas-empresas') &&
    !req.url.includes('/v1/imobilizado/empresas');

  if (ehDadosImob && empresa.id() != null) {
    req = req.clone({ setHeaders: { 'X-Empresa-Id': String(empresa.id()) } });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (ehDadosImob && err.status === 403) empresa.perdeuAcesso(); // limpa seleção e reabre o seletor
      return throwError(() => err);
    }),
  );
};
```

> `empresa-ativa` **precisa** do header e não casa com a exclusão `/v1/imobilizado/empresas` (que é a administração), então o interceptor acima já o envia.

---

## 4. Seletor de empresa

### Fluxo

1. Ao entrar na área Imobilizado (ou após login), chamar `GET /v1/imobilizado/minhas-empresas`.
2. Decidir:
   - **0 empresas** → tela "Você ainda não tem acesso a nenhuma empresa. Peça a um administrador." (sem menu de dados). Se o usuário for `admin`, oferecer atalho para a administração de empresas.
   - **1 empresa** → selecionar automaticamente.
   - **2+ empresas** → se houver seleção salva e ela estiver na lista, restaurar; senão abrir o seletor (modal obrigatório, sem fechar sem escolher).
3. Persistir só o **id** em `localStorage` (`imob.empresaId`). Validar a restauração com `empresa-ativa` ou checando a lista de `minhas-empresas`.
4. Exibir a empresa ativa no cabeçalho da área (nome fantasia ou razão social + CNPJ formatado) com ação "Trocar".

### Trocar de empresa

- Atualizar o id ativo e **descartar todo cache/estado** das telas do módulo (listas, filtros, formulários abertos) e navegar para o dashboard da área.
- Sem novo login e sem novo token.

### Wireframe

```
┌───────────────────────────────────────────────────────────────┐
│ Imobilizado      Empresa: Alfa · 11.222.333/0001-81  [Trocar] │
└───────────────────────────────────────────────────────────────┘

┌─ Selecione a empresa ─────────────────┐
│  ( ) Indústria Alfa Ltda  — 11.222... │
│  ( ) Comércio Beta S/A    — 44.555... │
│                          [Continuar]  │
└───────────────────────────────────────┘
```

### Tratamento de 403 (perda de acesso)

Quando qualquer chamada de dados retornar `403`:

1. Limpar a empresa ativa.
2. Recarregar `minhas-empresas`.
3. Mostrar aviso: "Seu acesso a esta empresa foi alterado." e reabrir o seletor (ou a tela "sem acesso" se a lista vier vazia).

---

## 5. Administração de empresas (somente `admin`)

Menu visível apenas para `role === 'admin'`. Todas as rotas abaixo **não** usam `X-Empresa-Id`. Roles diferentes de `admin` recebem `403`.

### 5.1 Listar — `GET /v1/imobilizado/empresas?page=1&pageSize=50`

Resposta paginada (`pageSize` máximo 100):

```json
{ "items": [ /* ImobEmpresaResponse */ ], "page": 1, "pageSize": 50, "total": 2 }
```

Tabela com: razão social, nome fantasia, CNPJ (formatado), situação (Ativa/Inativa), ações.

### 5.2 Criar — `POST /v1/imobilizado/empresas`

```json
{ "razaoSocial": "Indústria Alfa Ltda", "nomeFantasia": "Alfa", "cnpj": "11.222.333/0001-81" }
```

- `razaoSocial` obrigatório (máx. 255); `nomeFantasia` opcional (máx. 255); `cnpj` obrigatório, aceita com ou sem máscara (o servidor grava só dígitos).
- `201` + `ImobEmpresaResponse`. Erros `400` com `{ "error": "..." }`: CNPJ inválido, CNPJ com 11 dígitos (CPF não é aceito), CNPJ já cadastrado.
- Validação de CNPJ no cliente (dígitos verificadores) é desejável para feedback imediato; o servidor sempre valida.

### 5.3 Editar — `PUT /v1/imobilizado/empresas/{id}`

Mesmo corpo do criar, mais `"ativo": true|false`. Empresa **inativa** deixa de aparecer em `minhas-empresas` e passa a responder `403` nos endpoints de dados para todos os seus usuários (imediato).

### 5.4 Excluir — `DELETE /v1/imobilizado/empresas/{id}`

Soft delete (`204`). Mesmo efeito de acesso da desativação. Confirmar com diálogo; preferir "Desativar" para uso cotidiano.

### 5.5 Usuários da empresa

| Ação | Endpoint | Corpo | Resposta |
|---|---|---|---|
| Listar | `GET /v1/imobilizado/empresas/{id}/usuarios` | — | `[{ usuarioId, nome, email, ativo, criadoEm }]` |
| Vincular | `POST /v1/imobilizado/empresas/{id}/usuarios` | `{ "usuarioId": "<guid>" }` | `204` |
| Desvincular | `DELETE /v1/imobilizado/empresas/{id}/usuarios/{usuarioId}` | — | `204` |

- `ativo: false` na lista = vínculo desfeito (aparece como histórico; vincular de novo reativa).
- Vincular exige usuário existente e **ativo**; senão `400`.
- Para escolher o usuário, usar a listagem existente `GET /v1/users` (autocomplete por nome/e-mail).
- O usuário vinculado passa a ver a empresa em `minhas-empresas` na próxima consulta; o desvinculado perde o acesso na hora.

---

## 6. Estados e erros — resumo

| Situação | Sintoma | UI |
|---|---|---|
| Sem vínculo | `minhas-empresas` = `[]` | Tela "sem acesso" |
| Header ausente | `400` | Bug do cliente: logar erro, não mostrar ao usuário final |
| Empresa desativada/removida/desvinculado | `403` | Aviso + reabrir seletor |
| Role insuficiente na administração | `403` | Ocultar menu; mensagem genérica se acessar por URL |
| Token expirado | `401` | Fluxo de refresh já existente |
| Regra de negócio (CNPJ duplicado etc.) | `400` `{ error }` | Mostrar `error` no formulário |

## 7. Tipos TypeScript

```typescript
export interface ImobEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;        // 14 dígitos, sem máscara
  ativo: boolean;
  criadoEm: string;    // ISO 8601
}

export interface ImobUsuarioEmpresa {
  usuarioId: string;   // GUID
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobEmpresa { razaoSocial: string; nomeFantasia?: string; cnpj: string; }
export interface AtualizarImobEmpresa extends CriarImobEmpresa { ativo: boolean; }
```

## 8. Fora desta fatia

Perfil de acesso por empresa (Fase 5), planos/limites por empresa e registro da empresa ativa no log de auditoria (adiado).
