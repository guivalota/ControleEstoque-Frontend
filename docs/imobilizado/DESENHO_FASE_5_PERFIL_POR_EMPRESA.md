# Desenho da Fase 5.1 — Perfil de acesso por empresa

> **Status: IMPLEMENTADO (5.1a, 5.1b, 5.1c) — Q1–Q7 aceitas com as recomendações padrão.** Migration **0030**.
> Contexto: decisão D14 do plano (admin global = administrador da plataforma; perfil por empresa fica para a Fase 5).

## 1. Problema

Hoje a role (`admin` / `operador` / `leitura`) é **global**: quem é `operador` pode criar e editar em **todas** as empresas às quais está vinculado. Não dá para, por exemplo, ter um contador como `leitura` na empresa A e `operador` na B, ou dar a um gestor só consulta numa empresa específica.

## 2. Como o acesso funciona hoje

- `[Authorize(Roles = "...")]` em cada controller/ação (11 `admin`, 25 `admin,operador`, 32 `admin,operador,leitura` no módulo), avaliado **antes** de qualquer filtro, só com a role global do JWT.
- `ImobTenantFilter` (`[RequerEmpresa]`) valida o header `X-Empresa-Id` contra `imob_usuario_empresa` (vínculo ativo + empresa ativa), com cache positivo de 30 s, e guarda a empresa no `TenantContext`.
- `imob_usuario_empresa (usuario_id, empresa_id, ativo)` não tem perfil.

## 3. Proposta

### 3.1 Modelo: o perfil da empresa **restringe**, nunca amplia (teto = role global)

- Nova coluna `imob_usuario_empresa.perfil` (`admin` | `operador` | `leitura`).
- **Perfil efetivo** na empresa = o **menor** entre a role global do usuário (JWT) e o perfil do vínculo; **admin global (administrador da plataforma) é sempre admin** em qualquer empresa.
- A role global continua sendo o teto: as anotações `[Authorize(Roles)]` existentes **não mudam** (nenhum dos ~70 pontos de autorização é editado). Um usuário `operador` global pode ser `leitura` na empresa B, mas um `leitura` global não vira `operador` numa empresa.

### 3.2 Aplicação da regra sem editar controllers

O `ImobTenantFilter` já roda depois do `[Authorize]` e conhece a empresa. Ele passa a:

1. obter o perfil do vínculo (mesma consulta/cache do acesso, que agora devolve o perfil);
2. calcular o perfil efetivo;
3. ler as roles exigidas pela ação em `EndpointMetadata` (`IAuthorizeData`: controller + ação; cada atributo é um "OU" de roles e vários atributos são "E");
4. se o perfil efetivo não está nas roles exigidas → **403** `"Seu perfil nesta empresa (leitura) não permite esta ação."`.

O perfil efetivo fica no `TenantContext` (`PerfilEfetivo`) para uso futuro (relatórios, auditoria) e é devolvido ao frontend.

### 3.3 Endpoints (plataforma, só `admin` global)

| Rota | Mudança |
|---|---|
| `POST /v1/imobilizado/empresas/{id}/usuarios` | corpo ganha `perfil` (opcional; padrão = role global do usuário). `400` se o perfil exceder a role global do usuário |
| `PUT /v1/imobilizado/empresas/{id}/usuarios/{usuarioId}` | **novo**: altera o perfil de um vínculo ativo (invalida o cache) |
| `GET /v1/imobilizado/empresas/{id}/usuarios` | cada item ganha `perfil` e `perfilEfetivo` |
| `GET /v1/imobilizado/minhas-empresas` | cada empresa ganha `perfil` (efetivo) para o front esconder botões de escrita |
| `GET /v1/imobilizado/empresa-ativa` | ganha `perfil` (efetivo) |

### 3.4 Dados e migração

- Migration 0030: `ALTER TABLE imob_usuario_empresa ADD COLUMN perfil VARCHAR(10) NOT NULL DEFAULT 'leitura' CHECK (...)`; **backfill** com a role global atual de cada usuário (quando a tabela `usuarios` existe), para **ninguém ganhar nem perder acesso** na migração. Novos vínculos sem perfil usam a role global do usuário.
- `sp_vincular_imob_usuario_empresa` e uma nova `sp_alterar_perfil_imob_usuario_empresa` (com `p_empresa_id` primeiro). Reativar um vínculo desativado atualiza o perfil informado.
- O cache de acesso passa a guardar o perfil; alterar perfil ou desvincular invalida o cache imediatamente (no processo atual; entre instâncias vale o TTL de 30 s, como já é para o vínculo).

### 3.5 O que **não** muda

JWT e `AuthController`; as anotações `[Authorize(Roles)]`; o Estoque; as regras de negócio por papel (aprovar OS e fechar depreciação continuam `admin`; agora "admin" significa admin **naquela empresa** ou da plataforma).

## 4. Testes obrigatórios

- **Unitário:** função pura `PerfilPermite(perfil, rolesExigidas[])` (OU dentro do atributo, E entre atributos), cálculo do perfil efetivo (mínimo, admin global), validação "perfil não excede a role global".
- **Repositório:** coluna/CHECK, backfill pela role global, vincular com perfil, alterar perfil, reativar, **vazamento** (perfil da empresa A não vale na B; alterar vínculo da A não afeta B).
- **Integração (matriz):** usuário `operador` global com perfil `leitura` na B → `POST` de bem na B = `403` e na A = `201`; `GET` na B = `200`; perfil `operador` não aprova OS nem fecha depreciação (já `admin`); admin global sempre passa; admin global vinculado com perfil gravado `leitura` continua admin; `PUT` de perfil reflete na hora; perfil não pode exceder a role global (`400`); desvincular = `403`; operador/leitura não gerenciam vínculos; `minhas-empresas` mostra o perfil por empresa.

## 5. Fatias

| Fatia | Entrega |
|---|---|
| **5.1a** | migration 0030, repositório/serviços de vínculo com perfil, `PUT` de perfil, DTOs, cache com perfil |
| **5.1b** | regra no `ImobTenantFilter` (+ `TenantContext.PerfilEfetivo`), `minhas-empresas`/`empresa-ativa` com perfil, testes de matriz de autorização |
| **5.1c** | spec de frontend (seletor de empresa mostra o perfil; esconder botões de escrita; tela de vínculos com perfil), `CLAUDE.md`, plano |

Depois do 5.1, a ordem sugerida para o restante da Fase 5: etiquetas PDF com QR (valor imediato para o inventário), importação Excel, planos/limites, campos customizados, fotos e contrato do app Flutter.

## 6. Decisões em aberto (❓)

| # | Pergunta | Recomendação |
|---|---|---|
| Q1 | O perfil da empresa pode **ampliar** a role global? | **Não**: só restringe (teto = role global). Ampliar exigiria trocar os ~70 `[Authorize(Roles)]` por uma verificação por empresa |
| Q2 | Perfil padrão ao vincular sem informar | A role global do usuário |
| Q3 | Backfill dos vínculos existentes | A role global atual (ninguém ganha nem perde acesso) |
| Q4 | Admin global (plataforma) | Sempre admin efetivo em qualquer empresa vinculada, ignorando o perfil gravado (evita se trancar fora) |
| Q5 | Quem altera perfis | Só o admin da plataforma. "Admin da empresa" gerenciar os vínculos da própria empresa fica para depois |
| Q6 | Role global rebaixada depois | O perfil efetivo cai automaticamente (mínimo); o perfil gravado maior fica registrado, e a API mostra `perfil` e `perfilEfetivo` |
| Q7 | Auditar mudanças de perfil | Já cai no log de acesso (PUT com empresa/usuário); uma trilha própria de vínculos fica como melhoria futura |

## 7. Riscos

- **Relaxar sem querer:** o filtro só pode *negar* além do `[Authorize]`; nunca concede. O teste de matriz cobre as três combinações do módulo (admin, admin+operador, todos).
- **Metadata de autorização:** o filtro considera só `IAuthorizeData` com `Roles`; testes garantem que a interpretação (OU dentro do atributo, E entre atributos) é igual à do ASP.NET.
- **Cache entre instâncias:** mudança de perfil pode levar até 30 s para valer em outra instância (documentado, igual ao vínculo).
