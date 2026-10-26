# Prompt de continuação (VS Code)

Como usar: abra esta pasta no VS Code (`controle-estoque-dotnet`), confirme que está na branch `tbrt-imobilizado`, abra o painel do Claude Code e cole **tudo** abaixo da linha.

---

Estamos desenvolvendo um **módulo de Imobilizado (controle patrimonial)** dentro deste projeto .NET (ControleEstoque), na branch `tbrt-imobilizado`. Antes de qualquer coisa, leia `CLAUDE.md` e `docs/imobilizado/PLANO_DE_ACAO.md`: eles são a fonte de verdade.

## Contexto
- O produto é inspirado na "Central de Ativos" (Saraf): cadastro de bens com plaqueta, inventário com conciliação (esperado × lido), ordens de serviço com aprovação (transferência, manutenção, sinistro, venda, baixa), depreciação e relatórios. Um app mobile (Flutter) virá depois; **agora o foco é backend + cliente web**.
- O backend é .NET 10, 4 camadas (Api → Application → Domain ← Infrastructure), **Dapper + SQL explícito + stored procedures + DbUp**, PostgreSQL (Supabase em produção), JWT com roles `admin`/`operador`/`leitura`, auditoria automática, soft delete, 310 testes (unit, repository e integration com Testcontainers). **Não usar Entity Framework** (decisão fixa do projeto).
- O frontend é um repositório separado, já pronto; o módulo entrará como uma **nova área "Imobilizado"**. Cada fatia deve gerar uma spec em Markdown em `docs/imobilizado/`, no estilo do `frontend-spec-v1.8.md`.

## Decisões já tomadas (não reabrir sem me perguntar)
1. **Separação total** entre Estoque e Imobilizado: nenhuma FK nem reuso de `produtos`, `categorias`, `fornecedores`, `notas_fiscais` ou `movimentacoes`. Fornecedor no bem é só texto livre. O responsável pelo bem tem cadastro próprio (`imob_responsaveis`).
2. Reaproveitar **somente** infraestrutura transversal: autenticação/JWT, usuários, roles, auditoria, `DomainException`, `PagedResult`, e-mail, QuestPDF, `CsvExporter`.
3. Rotas em **`v1/imobilizado/...`**; tabelas `imob_*`; stored functions `sp_*_imob_*`; código em subpastas `Imobilizado/` de cada camada.
4. Migrations a partir de **`0012`** (a última existente é a `0011`); nunca alterar migrations já existentes.
5. Aprovação de OS restrita a `admin` no início.
6. Hospedagem Docker local + ngrok é só para o MVP; não nos preocupamos com infra nem com o app Flutter agora.
7. **Multiempresa desde o início, só no módulo Imobilizado** (Estoque não muda):
   - Toda tabela `imob_*` (exceto `imob_empresas` e `imob_usuario_empresa`) tem `empresa_id NOT NULL`, unicidades por empresa (ex.: `UNIQUE (empresa_id, plaqueta)`) e FKs compostas `(empresa_id, id)`.
   - A empresa ativa vem do header **`X-Empresa-Id`**, validado em toda requisição contra o vínculo do usuário (`imob_usuario_empresa`) por um `ITenantContext`/filtro aplicado só aos controllers de `v1/imobilizado`. **Não alterar o JWT nem o `AuthController`.**
   - `empresaId` é parâmetro obrigatório em todo método de repositório e em toda SP (`p_empresa_id`). Não usar RLS por sessão (incompatível com o pooler do Supabase em modo transação).
   - O `admin` global é o administrador da plataforma (cria empresas e vincula usuários). Perfil por empresa fica para depois; no MVP vale a role global.
   - Toda fatia precisa de **testes de vazamento entre empresas** (duas empresas, dois usuários).
8. Depreciação **linear**, calculada sob demanda e gravada no fechamento do período; as regras devem ser validadas por um contador antes de uso real.

## Fatos importantes sobre o código
- Receita de nova entidade (do `CLAUDE.md`): Entity → interface do repositório (Domain) → interface do serviço → DTOs → serviço → repositório → controller com `[Authorize(Roles)]` → registro `AddScoped` em `Program.cs`. O `LoteService`/`LoteRepository`/`LotesController`/`0010_lotes.sql` são o melhor exemplo recente de fatia completa.
- DML sempre via stored functions; repositórios chamam `SELECT sp_xxx(@Param...)`. `UsuarioId` vem do JWT (claim `sub`), nunca do cliente. Páginação máxima de 100 itens.
- **Armadilha nos testes:** `CustomWebApplicationFactory` (integração) e cada classe de `RepositoryTests` recriam o schema à mão (`CreateTablesSql`/`CreateSpsSql`) com migrations desligadas. Toda tabela/SP nova do módulo precisa ser refletida lá. Isso é o item **0.2 do plano**: **proponha** a solução menos invasiva (ex.: rodar o DbUp nos testes, ou um helper compartilhado só para `imob_*`) e **espere meu aval antes de alterar a infra de testes existente**.

## O que quero agora
1. Execute a **Fase 0** do plano: registre no `CLAUDE.md` uma seção "Módulo Imobilizado" com as decisões acima e as convenções; defina a estrutura de pastas `Imobilizado/` e os padrões de nome.
2. Me apresente a proposta do item 0.2 e aguarde minha decisão.
3. Em seguida, implemente a **Fase 0B (fundação multiempresa)** como primeira fatia vertical: migration `0012_imob_empresas`, empresas, vínculo usuário↔empresa, "minhas empresas", `ITenantContext` com o header `X-Empresa-Id`, testes de acesso e a spec de frontend (seletor de empresa). Sobre auditar `empresa_id` no `audit_logs` (item 0B.5), **pergunte antes**, pois altera uma tabela existente.
4. Só depois implemente a **Fase 1.1 (Locais, em árvore)** já com `empresa_id`: migration `0013`, entidade, repositório e SPs, DTOs, serviço (com proteção contra ciclos na árvore), controller em `v1/imobilizado/locais`, testes nos três níveis e a spec de frontend. Rode `dotnet build` e as suítes de teste (Docker deve estar ativo) e me reporte o resultado real, incluindo falhas.

## Regras de trabalho
- Antes de editar, mostre um plano curto; faça commits pequenos e em português no estilo do histórico (`feat:`, `fix:`...), **sem fazer push** e sem mexer em `master`.
- Não altere arquivos do módulo de estoque, exceto o estritamente necessário (registro de DI e infra de testes, esta última só com meu aval).
- Siga as convenções do `CLAUDE.md` à risca e o padrão de nome de teste `Metodo_Cenario_ResultadoEsperado`.
- Se algo no plano estiver errado ou ambíguo, pergunte antes de seguir.
