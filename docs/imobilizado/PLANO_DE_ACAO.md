# Plano de Ação — Módulo Imobilizado (controle patrimonial)

> Branch: `tbrt-imobilizado` · Escopo atual: **somente backend + cliente web**. O app Flutter fica para uma etapa futura.
> Inspiração funcional: produto "Central de Ativos" (Saraf) — cadastro de bens, inventário com conciliação, ordens de serviço com aprovação, depreciação e relatórios.

---

## 1. Decisões já tomadas

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Separação total** entre Estoque e Imobilizado. Nenhuma FK entre as tabelas dos dois módulos (nem `produtos`, `categorias`, `fornecedores`, `notas_fiscais`, `movimentacoes`). | São domínios diferentes: estoque controla *quantidades*; imobilizado controla *unidades únicas* com plaqueta, local e depreciação. |
| D2 | **Reaproveita apenas infraestrutura transversal:** autenticação/JWT, usuários e roles, auditoria (`AuditAccessFilter`), `DomainException`, `PagedResult`, rate limit, CORS, health, Serilog, QuestPDF, `CsvExporter`. | Evita retrabalho sem acoplar os domínios. |
| D3 | Rotas sob **`v1/imobilizado/...`**. | Isolamento claro de API. |
| D4 | Tabelas com prefixo **`imob_`**; stored functions `sp_*_imob_*`. | Convenção que torna a separação visível no banco. |
| D5 | Mesma stack do projeto: **Dapper + SQL explícito + stored procedures + DbUp**. **Sem EF Core** (decisão do `CLAUDE.md`). | Consistência; decisão que "não deve ser revertida". |
| D6 | Mesmos projetos e 4 camadas, organizados por subpasta `Imobilizado/` em cada camada. | Evita nova solution; mantém a receita de nova entidade do `CLAUDE.md`. |
| D7 | Roles existentes (`admin`, `operador`, `leitura`). Aprovação de OS restrita a `admin` no início. | Sem mexer em auth. |
| D8 | **Fornecedor não é cadastro** no imobilizado. O bem terá apenas o campo texto livre `fornecedor_nome` (opcional) e `numero_documento_aquisicao`. | Pedido explícito de separação. |
| D9 | **Responsável pelo bem** é cadastro próprio (`imob_responsaveis`), pois nem toda pessoa responsável é usuário do sistema. | Separação do cadastro de usuários. |
| D10 | Frontend (repositório separado, já existente) ganha uma **nova área "Imobilizado"**. Cada fatia gera uma spec em Markdown, como o `frontend-spec-v1.8.md`. | Mesmo fluxo de trabalho atual. |
| D11 | Hospedagem atual (Docker local + ngrok) é só para viabilidade/MVP. Infra real virá depois. | Sem preocupação com URL fixa agora. |
| D12 | **Multiempresa (multi-tenant) desde o início**, só no módulo Imobilizado. Toda tabela `imob_*` (exceto a de empresas e a de vínculos) tem `empresa_id NOT NULL`. O módulo de Estoque continua single-tenant e não é alterado. | Decisão do usuário. O `PENDENCIAS.md` dizia para não iniciar multi-tenant sem demanda; agora há demanda. |
| D13 | **(Aprovada)** **Empresa ativa por requisição via header `X-Empresa-Id`**, validado contra o vínculo do usuário a cada chamada (`ITenantContext`, aplicado por filtro apenas nos controllers de `v1/imobilizado`). **Sem alterar o JWT nem o `AuthController`.** | Mantém a auth existente intacta e permite o usuário trocar de empresa sem novo login. |
| D14 | **Vínculo usuário↔empresa** em tabela própria (`imob_usuario_empresa`, N:N). Não se altera a tabela `usuarios`. O `admin` global é o **administrador da plataforma**: cria empresas e vincula usuários. Perfil por empresa (admin/operador/leitura diferente em cada empresa) fica para a Fase 5; no MVP vale a role global. | Mudança aditiva; separação do estoque preservada. |
| D15 | **Isolamento em camadas:** (1) todo método de repositório recebe `empresaId` obrigatório e filtra por ele; (2) SPs recebem `p_empresa_id`; (3) unicidades são por empresa (ex.: `UNIQUE (empresa_id, plaqueta)`); (4) FKs compostas `(empresa_id, id)` impedem referenciar registro de outra empresa; (5) testes de vazamento entre empresas obrigatórios em toda fatia. **Não usar RLS por sessão** (`SET app.empresa_id`), pois o pooler do Supabase (porta 6543, modo transação) e conexões Dapper por chamada tornam isso frágil. | Segurança prática nesta stack. |

## 2. Princípios para as fatias

1. **Uma fatia vertical por vez:** migration → entidade → interface de repositório → DTOs → serviço → repositório → controller → DI → testes (unit, repository, integration) → spec do frontend.
2. Seguir **à risca** a receita de 8 passos e as convenções do `CLAUDE.md` (snake_case↔PascalCase, `DateOnlyTypeHandler`, filtros dinâmicos com `DynamicParameters`, `CAST` em `SUM`, soft delete, erros via `DomainException`, `UsuarioId` sempre do JWT).
3. Toda tabela mutável tem `deletado_em`; todo SELECT filtra `deletado_em IS NULL`.
4. Cada migration é **idempotente quando possível** e nunca altera migrations já aplicadas (próxima: `0012`).
5. Testes com nome `Metodo_Cenario_ResultadoEsperado`.
6. Commits pequenos, um por fatia ou sub-etapa; não tocar em arquivos do módulo de estoque, exceto onde estritamente necessário (DI, factory de testes).

## 3. Modelo de dados (rascunho — refinar em cada fatia)

**Regra geral (D12/D15):** toda tabela abaixo, exceto `imob_empresas` e `imob_usuario_empresa`, tem `empresa_id INT NOT NULL REFERENCES imob_empresas(id)`, índice iniciado por `empresa_id`, e unicidades compostas com `empresa_id`. Relacionamentos entre tabelas do módulo usam FK composta `(empresa_id, id)`.

```
imob_empresas          id, razao_social, nome_fantasia, cnpj (UNIQUE), ativo, criado_em, deletado_em
                       (futuro: plano/limite_itens)
imob_usuario_empresa   usuario_id (UUID, sem FK dura para não acoplar), empresa_id, ativo, criado_em
                       PRIMARY KEY (usuario_id, empresa_id)

imob_locais            id, nome, codigo, local_pai_id (árvore), ativo, criado_em, deletado_em
imob_categorias        id, nome, vida_util_meses, valor_residual_percentual, metodo_depreciacao ('linear'), ativo, ...
imob_responsaveis      id, nome, matricula, email, setor, ativo, ...
imob_bens              id, plaqueta (UNIQUE), descricao, categoria_id, local_id, responsavel_id?,
                       data_aquisicao, valor_aquisicao, valor_residual, vida_util_meses,
                       status ('ativo','em_manutencao','baixado','vendido','extraviado'),
                       fornecedor_nome?, numero_documento_aquisicao?, numero_serie?, observacao,
                       campos_custom JSONB, foto_url?, criado_em, atualizado_em, deletado_em
imob_bens_historico    id, bem_id, campo, valor_anterior, valor_novo, usuario_id, criado_em   -- trilha de alterações

imob_inventarios       id, nome, descricao, status ('rascunho','em_andamento','concluido','cancelado'),
                       data_inicio, data_fim, criado_por (UUID), criado_em, deletado_em
imob_inventario_locais id, inventario_id, local_id                         -- escopo
imob_inventario_equipe id, inventario_id, usuario_id (UUID)                -- quem conta
imob_leituras          id, inventario_id, client_id UUID (UNIQUE por inventário), plaqueta_lida, bem_id?,
                       local_lido_id?, usuario_id, lido_em, origem ('web','app'), observacao
imob_conciliacao       id, inventario_id, bem_id?, plaqueta, situacao
                       ('encontrado','local_divergente','nao_encontrado','sobra','duplicado'), resolvido, ...

imob_ordens_servico    id, tipo ('transferencia','manutencao','sinistro','venda','baixa'), status
                       ('pendente','aprovada','rejeitada','concluida','cancelada'), solicitante_id (UUID),
                       justificativa, valor_venda?, criado_em, ...
imob_os_itens          id, os_id, bem_id, local_origem_id, local_destino_id?, responsavel_destino_id?
imob_os_aprovacoes     id, os_id, aprovador_id (UUID), decisao, comentario, criado_em

imob_depreciacao       id, bem_id, competencia (DATE, 1º dia do mês), valor, acumulada, valor_contabil, criado_em
                       UNIQUE (bem_id, competencia)
```

`client_id` em `imob_leituras` já prepara o app offline (idempotência), mesmo sem o app agora.

## 4. Fases

### Fase 0 — Preparação (≈ 1–2 dias)
- [x] **0.1** Adicionar seção "Módulo Imobilizado" ao `CLAUDE.md` com as decisões D1–D12 e as convenções do módulo.
- [x] **0.2** **Infra de testes (precisa de aval antes de mexer):** hoje `CustomWebApplicationFactory` e cada `RepositoryTest` duplicam o schema à mão (`CreateTablesSql` / `CreateSpsSql`). Para o módulo novo, propor uma única fonte: rodar o **DbUp** nos testes (ou, no mínimo, um helper compartilhado só para as tabelas `imob_*`). Escolher a opção menos invasiva.
- [x] **0.3** Definir a estrutura de pastas `Imobilizado/` por camada e o padrão de nomes (`ImobBem`, `ImobBemService`, `ImobBensController`...).
- [x] **0.4** Criar `docs/imobilizado/` para specs de frontend por fatia.

**Pronto quando:** `dotnet build` e os 310 testes atuais continuam verdes; convenções registradas.

### Fase 0B — Fundação multiempresa (≈ 1 semana) — **vem antes de qualquer cadastro**
Migration `0012_imob_empresas.sql`.
- [x] **0B.1** Tabelas `imob_empresas` e `imob_usuario_empresa` + SPs.
- [x] **0B.2** CRUD de empresas (`v1/imobilizado/empresas`, **apenas `admin`**) e vínculo de usuários (`v1/imobilizado/empresas/{id}/usuarios`, apenas `admin`). Listar "minhas empresas" (`v1/imobilizado/minhas-empresas`, qualquer usuário autenticado) para o seletor do frontend.
- [x] **0B.3** `ITenantContext` (Application) + implementação (Api) que lê `X-Empresa-Id`, valida vínculo ativo e empresa ativa (cache curto, como o `role_version`) e responde **400/403** se ausente ou sem acesso. Aplicado por filtro/atributo nos controllers de dados do módulo.
- [x] **0B.4** Convenção de repositório: `empresaId` obrigatório em toda assinatura; helper de teste que cria duas empresas e dois usuários.
- [ ] **0B.5** Auditoria: avaliar adicionar `empresa_id` (nullable) ao `audit_logs` para registrar a empresa ativa. É alteração aditiva em tabela existente — **pedir aval antes**. **Adiado por decisão do usuário (retomar em fatia futura).**
- [x] **0B.6** Testes: acesso sem header, com empresa de outro usuário, empresa inativa, usuário desvinculado (não acessa mais), `leitura` sem escrita.
- [x] **0B.7** Spec de frontend: seletor de empresa, envio do header em todas as chamadas da área, tratamento de 403, telas de empresas/vínculos para `admin`.

**Pronto quando:** um usuário vinculado a duas empresas consegue alternar entre elas, e um usuário sem vínculo recebe 403 em qualquer endpoint de dados.

### Fase 1 — Cadastros base e bens (≈ 1–2 semanas)
Uma migration por cadastro: `0013_imob_locais` (feita), `0014_imob_categorias` (feita), `0015_imob_responsaveis`, `0016_imob_bens` (feita; inclui a tabela e a gravação do histórico — a fatia 1.5 só expõe a consulta). Mais: `0017_imob_bens_dados_pendentes` (feita: data e valor de aquisição opcionais) e `0018_imob_importacao_bens` (1.6).
- [x] **1.1** Locais (árvore, com proteção contra ciclo) — `v1/imobilizado/locais`
- [x] **1.2** Categorias de bem — `v1/imobilizado/categorias`
- [x] **1.3** Responsáveis — `v1/imobilizado/responsaveis`
- [x] **1.4** Bens (CRUD, filtros por local/categoria/status/responsável/texto, busca por plaqueta, paginação, export CSV) — `v1/imobilizado/bens`
- [x] **1.5** Histórico de alterações do bem — `v1/imobilizado/bens/{id}/historico`
- [x] **1.6** Importação em massa por **CSV** (pré-validação com relatório de erros por linha, depois confirmação) — `v1/imobilizado/bens/importacao`
- [x] **1.7** Spec de frontend da fatia.

**Pronto quando:** importar um CSV de ~10 mil bens, filtrar e exportar com desempenho aceitável; testes nos 3 níveis.

### Fase 2 — Inventário e conciliação (≈ 2 semanas)
Migrations: `0019_imob_inventarios` (feita: cabeçalho, escopo, equipe e snapshot do esperado), `0020_imob_leituras`, `0021_imob_conciliacao` e `0022_imob_resolucoes` e `0023_imob_encerramento` (feitas); as seguintes seguem em sequência a partir de `0024`.
- [x] **2.1** Criar/editar inventário, definir escopo (locais) e equipe — `v1/imobilizado/inventarios`
- [x] **2.2** Registrar leituras: manualmente na web e por **importação CSV de leituras** (simula o futuro app). Idempotência por `client_id`.
- [x] **2.3** Motor de conciliação (encontrado / local divergente / não encontrado / sobra / duplicado), recalculável.
- [x] **2.4** Painel de acompanhamento (progresso por local/equipe) e tratamento de divergências (resolver, ajustar local do bem).
- [x] **2.5** Encerramento do inventário (trava resultados) + relatório PDF/CSV.
- [x] **2.6** Endpoints "de sincronização" **desenhados no contrato** (escopo do inventário para download e envio de leituras em lote), documentados mas sem foco em desempenho do mobile ainda.
- [x] **2.7** Spec de frontend.

**Pronto quando:** simular um inventário completo só pela web/CSV e obter a conciliação correta.

### Fase 3 — Ordens de serviço e aprovação (≈ 2 semanas)
Migration da Fase 3: próximo número livre após a Fase 2.
- [ ] **3.1** Abrir OS (transferência, manutenção, sinistro, venda, baixa) com itens.
- [ ] **3.2** Aprovar/rejeitar (somente `admin`); regras de transição de status.
- [ ] **3.3** Efeito da aprovação **atômico** (SP com transação): atualiza local/responsável/status do bem + grava histórico.
- [ ] **3.4** Notificação por e-mail (reusar `IEmailService`) — opcional.
- [ ] **3.5** Spec de frontend.

### Fase 4 — Depreciação e relatórios (≈ 2–3 semanas)
Migration da Fase 4: próximo número livre após a Fase 3.
- [ ] **4.1** Cálculo **linear** calculado sob demanda por bem/competência (função pura e testada).
- [ ] **4.2** Fechamento de período: grava `imob_depreciacao` para todos os bens (endpoint `admin`; opcionalmente `BackgroundService` mensal, no estilo do `AlertaBackgroundService`).
- [ ] **4.3** Relatórios: razão de depreciação, valor contábil por período, bens por categoria/local/responsável, baixas.
- [ ] **4.4** Dashboard do módulo.
- [ ] **4.5** **Validação das regras com um contador** (CPC 27 / IAS 16, taxas fiscais, valor residual) antes de qualquer uso real.
- [ ] **4.6** Spec de frontend.

### Fase 5 — Refinamentos (contínuo)
Perfil de acesso por empresa (coluna `perfil` em `imob_usuario_empresa`), planos com limite de itens por empresa (como na proposta da Saraf, com aviso ao exceder 10%), fotos (ex.: Supabase Storage), impressão de etiquetas (PDF com código de barras/QR via QuestPDF), campos customizados por empresa, importação Excel, e preparação do **contrato para o app Flutter** (endpoint de sync com cursor, paginação maior que 100, tokens para uso offline).

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Duplicação do schema nos testes torna cada tabela nova trabalhosa | Item 0.2 |
| Acoplamento acidental com o módulo de estoque | Prefixo `imob_`, sem FK entre módulos, revisão em cada PR |
| Regras de depreciação incorretas | Cálculo isolado + testes + validação contábil (4.5) |
| Importação grande travar a API | Processar em lotes dentro de SP/transação por lote; limitar tamanho; relatório de erros |
| Árvore de locais com ciclos | Validar no serviço e na SP; testes específicos |
| Vazamento de dados entre empresas (esquecer o filtro `empresa_id`) | `empresaId` obrigatório nas assinaturas, FKs compostas, testes de vazamento em toda fatia, revisão específica em cada PR |
| Usuário manipular `X-Empresa-Id` | Header sempre validado contra `imob_usuario_empresa` no servidor; nunca confiar no valor sem checar |
| Cache do vínculo manter acesso após desvincular | Cache curto (≈30 s) e invalidação ao alterar vínculo |
| Importações grandes de uma empresa afetarem as outras | Limite de tamanho por importação, rate limit e processamento em lotes |

## 6. Fora de escopo agora
App Flutter · RFID · voz · GPS · perfil de acesso diferente por empresa · planos/limites por empresa · hospedagem definitiva · SSO.

## 7. Próximo passo imediato
Fase 0.1 e 0.3 (registrar convenções), decidir 0.2, e então a **Fase 0B (empresas + `ITenantContext`)**, que é a primeira fatia vertical e valida o padrão multiempresa. Só depois iniciar a **Fase 1.1 (Locais)**, já com `empresa_id`.
