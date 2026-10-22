# Spec de Frontend — Imobilizado: Responsáveis (Fase 1.3)

> Backend na branch `tbrt-imobilizado` (migration `0015_imob_responsaveis`).
> Pré-requisito: `frontend-spec-imob-0b-empresas.md` (empresa ativa e header `X-Empresa-Id`).

---

## Visão geral

Responsável é a pessoa que responde por um bem (ex.: o colaborador que está com o notebook). É um **cadastro próprio do módulo** — não é usuário do sistema, não tem login e não se relaciona com o cadastro de usuários nem com clientes/fornecedores do Estoque. Cada empresa mantém os seus.

- **Todos** os endpoints exigem `X-Empresa-Id` (o interceptor da spec 0B já envia).
- Roles: leitura (`GET`) — `admin`, `operador`, `leitura`; criar/editar — `admin`, `operador`; excluir — `admin`.
- Responsável de outra empresa é indistinguível de inexistente: `GET` → `404`; `PUT`/`DELETE` → `400` "não encontrado".

---

## 1. Listar — `GET /v1/imobilizado/responsaveis`

| Query | Tipo | Descrição |
|---|---|---|
| `busca` | `string` | Contém, sem diferenciar maiúsculas, em `nome`, `matricula` ou `email` (`%` e `_` são literais) |
| `setor` | `string` | Setor **igual** ao informado, sem diferenciar maiúsculas |
| `ativo` | `bool` | Filtra por situação |
| `page` | `number` | Padrão 1 |
| `pageSize` | `number` | Padrão 50, **máximo 100** (valores maiores são reduzidos) |

```json
{
  "items": [
    {
      "id": 1, "nome": "Ana Souza", "matricula": "M100", "email": "ana@empresa.com",
      "setor": "TI", "ativo": true, "criadoEm": "2026-10-22T14:03:11Z"
    }
  ],
  "page": 1, "pageSize": 50, "total": 1
}
```

Ordenado por nome. Para selects/autocomplete de formulário de bem, use `ativo=true&busca=<texto>&pageSize=20` (busca sob demanda, sem carregar todos).

## 2. Detalhe — `GET /v1/imobilizado/responsaveis/{id}`

`200` com o item ou `404` `{ "error": "Responsável com id X não encontrado." }`.

## 3. Criar — `POST /v1/imobilizado/responsaveis`

```json
{ "nome": "Ana Souza", "matricula": "M100", "email": "ana@empresa.com", "setor": "TI" }
```

| Campo | Regra |
|---|---|
| `nome` | Obrigatório, máx. 255; espaços nas pontas removidos. **Não é único** (homônimos são comuns) |
| `matricula` | Opcional, máx. 50; vazio vira `null`. **Única na empresa** quando informada — é o que distingue homônimos |
| `email` | Opcional, máx. 255, formato de e-mail; gravado em minúsculas |
| `setor` | Opcional, máx. 100, texto livre (sem cadastro de setores nesta fase) |

`201` + item criado (`Location` aponta para o detalhe). Erros `400`: nome vazio, e-mail inválido, matrícula já usada na empresa.

> Erros de formato (ex.: e-mail inválido) podem vir no formato padrão do ASP.NET (`errors` por campo) ou como `{ "error": "..." }` das regras de negócio; trate os dois, como nas demais telas.

## 4. Editar — `PUT /v1/imobilizado/responsaveis/{id}`

Mesmo corpo do criar mais `"ativo": true|false` (corpo sempre completo; campos opcionais omitidos viram `null`).

- Desativar (ex.: colaborador desligado) **não** altera bens já atribuídos a ele; o front deve apenas deixar de oferecê-lo em novas atribuições (`ativo=true` nos selects). A tela de bens (Fase 1.4) deverá sinalizar bens sob responsável inativo.

## 5. Excluir — `DELETE /v1/imobilizado/responsaveis/{id}`

**Role:** `admin`. Exclusão lógica (`204`). A matrícula de um responsável excluído pode ser reutilizada.

> **Atualizado na Fase 1.4:** excluir um responsável que ainda tenha bens retorna `400` "Não é possível excluir um responsável que possui bens." Prefira "Desativar" no uso cotidiano. Ver `frontend-spec-imob-1-4-bens.md`.

---

## 6. Sugestão de UI

```
┌─ Responsáveis ───────────────────────  [+ Novo responsável] ┐
│ Buscar: [__________]  Setor: [Todos ▾]  [x] Somente ativos   │
├──────────────────────────────────────────────────────────────┤
│ Nome           Matrícula   E-mail            Setor    Ações  │
│ Ana Souza      M100        ana@empresa.com   TI       ✎ 🗑   │
│ Beto Lima      M200        beto@empresa.com  RH       ✎ 🗑   │
└──────────────────────────────────────────────────────────────┘
```

- O filtro "Setor" pode ser montado a partir dos setores já presentes nos resultados (não há endpoint de setores).
- Botões de criar/editar ocultos para `leitura`; excluir só para `admin`. Em `400`, mostrar `error` no formulário (campo matrícula quando a mensagem a citar).
- Ao exibir um responsável em outros contextos (ex.: bem), mostrar `nome (matrícula)` para distinguir homônimos.

## 7. Tipos TypeScript

```typescript
export interface ImobResponsavel {
  id: number;
  nome: string;
  matricula?: string | null;
  email?: string | null;
  setor?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobResponsavel {
  nome: string;
  matricula?: string;
  email?: string;
  setor?: string;
}
export interface AtualizarImobResponsavel extends CriarImobResponsavel { ativo: boolean; }

export interface ImobResponsavelFiltro {
  busca?: string; setor?: string; ativo?: boolean; page?: number; pageSize?: number;
}
```

## 8. Fora desta fatia

Importação por CSV, cadastro de setores, vínculo opcional com um usuário do sistema e vínculo com bens (Fase 1.4).
