# Prompt para o frontend (VS Code) — área "Imobilizado"

Como usar:
1. Copie a pasta `docs/imobilizado/` deste repositório (backend) para dentro do repositório do frontend (ex.: `docs/imobilizado/`), para as specs ficarem acessíveis ao Claude Code de lá. Copie também o `frontend-spec-v1.8.md` se ainda não estiver no frontend.
2. Abra o repositório do **frontend** no VS Code, na branch de trabalho (crie uma, ex.: `feat/imobilizado`; **não** trabalhe na principal).
3. Abra o painel do Claude Code e cole **tudo** abaixo da linha. Rode uma etapa por vez (o prompt já manda parar a cada etapa).

---

Vamos construir a nova área **"Imobilizado" (controle patrimonial)** neste frontend, consumindo uma API que já existe (backend .NET em outro repositório). A área é **separada** do módulo de Estoque: não altere telas, rotas, serviços nem modelos do Estoque, exceto o mínimo para incluir o item de menu "Imobilizado" e registrar as novas rotas.

## Fonte de verdade
As specs de contrato da API estão em `docs/imobilizado/` (copiadas do backend). **Leia-as antes de qualquer coisa**, na ordem:
1. `frontend-spec-imob-0b-empresas.md` — multiempresa: seletor de empresa, header `X-Empresa-Id`, administração de empresas/vínculos
2. `frontend-spec-imob-1-1-locais.md` — locais em árvore
3. `frontend-spec-imob-1-2-categorias.md` — categorias de bem
4. `frontend-spec-imob-1-3-responsaveis.md` — responsáveis
5. `frontend-spec-imob-1-4-bens.md` — bens (CRUD, filtros, busca por plaqueta, exportação CSV)
6. `frontend-spec-imob-1-5-historico-bem.md` — histórico de alterações do bem
7. `frontend-spec-imob-1-6-importacao-bens.md` — importação de bens por CSV (validar → confirmar)
8. `frontend-spec-imob-2-1-inventarios.md` — inventários (rascunho → em andamento → concluído/cancelado), escopo e equipe
9. `frontend-spec-imob-2-2-leituras.md` — leituras (manual, lote, importação CSV, anulação)
10. `frontend-spec-imob-2-3-conciliacao.md` — conciliação esperado × lido
11. `frontend-spec-imob-2-4-divergencias-painel.md` — decisão das divergências e painel
12. `frontend-spec-imob-2-5-encerramento-relatorio.md` — encerramento (só admin) e relatório PDF/CSV
13. `frontend-spec-imob-2-6-sincronizacao.md` — contrato do app de contagem (**só leitura**: o frontend web não implementa)
14. `PLANO_DE_ACAO.md` — contexto geral (somente leitura; não é tarefa do frontend)

As specs têm endpoints, regras, mensagens de erro, exemplos e tipos TypeScript. Se algo na spec estiver ambíguo ou parecer errado, **pergunte** antes de seguir. Se o backend se comportar diferente da spec, relate a divergência em vez de contornar em silêncio.

## Antes de codar: explore o frontend existente
Descubra e me resuma em poucas linhas, **sem editar nada ainda**: versão/estilo do framework (a spec v1.8 usa exemplos Angular), estrutura de pastas, como estão organizados rotas/guards/interceptors/serviços HTTP, biblioteca de UI e de formulários, como o token/refresh e o papel (`role`) do usuário são tratados hoje, padrão de listas paginadas, de diálogos de confirmação, de toasts/erros e de testes. **Siga esses padrões** — não introduza bibliotecas novas sem me perguntar.

## Regras de negócio que atravessam tudo
- **Multiempresa:** toda chamada de dados `v1/imobilizado/...` leva o header `X-Empresa-Id` com a empresa ativa (interceptor). **Exceções, sem o header:** `GET v1/imobilizado/minhas-empresas` e a administração `v1/imobilizado/empresas/**`. O front **nunca** envia `empresaId` em corpo ou query.
- Ao receber `403` em chamada de dados: limpar a empresa ativa, recarregar `minhas-empresas`, avisar "Seu acesso a esta empresa foi alterado" e reabrir o seletor. `400` por header ausente é bug do cliente (logar, não exibir ao usuário).
- Trocar de empresa descarta todo cache/estado da área e volta ao início dela. Persistir só o id em `localStorage` (`imob.empresaId`) e validar ao restaurar.
- **Papéis:** `admin`, `operador`, `leitura`. Esconder (e proteger por guard) o que o papel não pode: criar/editar = `admin`/`operador`; excluir = `admin`; administração de empresas/vínculos = só `admin`. O backend é quem decide de verdade — a UI só evita frustração.
- **Erros:** `400` pode vir como `{ "error": "..." }` (regra de negócio — mostre a mensagem) ou no formato padrão do ASP.NET com `errors` por campo (validação — mapeie para os campos). Trate os dois.
- Paginação: `pageSize` máximo **100**. Valores monetários em BRL na exibição; datas `yyyy-MM-dd` na API e `dd/MM/yyyy` na tela. O `admin` também precisa estar vinculado a uma empresa para acessar dados dela.
- O status do bem **não é editável** pela API (vem de OS/inventário, fases futuras): exiba, filtre, mas não ofereça edição.
- Exportação CSV exige o header: baixe via `HttpClient` com `responseType: 'blob'`, **não** com `<a href>`.

## Etapas (faça UMA por vez; ao fim de cada uma, rode build, lint e testes do frontend, mostre o resultado real e pare para eu aprovar)

**Etapa 1 — Fundação multiempresa** (spec 0B): serviço de empresa ativa (estado + `localStorage`), interceptor do header e do tratamento de `403`, seletor de empresa (modal obrigatório quando há 2+ empresas; auto-seleção com 1; tela "sem acesso" com 0), indicador da empresa ativa no cabeçalho da área com "Trocar", rotas da área "Imobilizado" com guard (exige empresa ativa) e item de menu.

**Etapa 2 — Administração de empresas (somente `admin`)**: lista paginada, criar/editar (CNPJ com máscara e validação de dígitos verificadores no cliente; o servidor sempre revalida), ativar/desativar, excluir com confirmação, e tela de usuários da empresa (listar, vincular com autocomplete a partir de `GET /v1/users`, desvincular).

**Etapa 3 — Cadastros-base**: Locais (árvore expansível, adicionar sublocal, mover, ocultar o próprio local e a subárvore no seletor de "local pai", tratar erro de ciclo), Categorias (vida útil em meses e anos, residual em %, método "Linear") e Responsáveis (busca, filtro por setor, mostrar `nome (matrícula)` para distinguir homônimos). Em todos: filtros `busca`/`ativo`, desativar vs. excluir, tratar o `400` de "possui bens" oferecendo "Desativar" e link para a lista de bens filtrada.

**Etapa 4 — Bens**: lista (colunas e filtros da spec: busca, local com "incluir sublocais" ligado por padrão, categoria, responsável, status; paginação), busca rápida por plaqueta (`por-plaqueta`), formulário de criar/editar (ao escolher a categoria, pré-preencher vida útil e % residual editáveis; se intocados, omitir os campos; **data e valor de aquisição são opcionais**: bens sem eles têm `dadosCompletos: false`, mostram o selo "Dados incompletos" e têm o filtro/atalho "Pendentes de completar"), detalhe do bem, excluir (`admin`), exportação CSV respeitando os filtros e o limite de 20.000 (mostrar a mensagem do `400`).

**Etapa 5 — Histórico do bem**: aba "Histórico" no detalhe, em linha do tempo, com "carregar mais", rótulos amigáveis por `campo`, nomes via `...Descricao` nos campos de referência, valores em BRL/datas formatados, `null` como "—", fallback para o id abreviado quando `usuarioNome` vier nulo.

**Etapa 6 — Importação de bens por CSV** (spec 1.6): tela em dois passos. (1) botão "Baixar modelo" (blob, por causa do header), seleção do arquivo `.csv` e do **local padrão** (árvore de locais ativos), botão "Validar". (2) relatório: totais, aviso de "dados incompletos", tabela de erros por linha (linha, plaqueta, campo, mensagem) com filtro por campo e "baixar relatório de erros" gerado no navegador, e as listas de categorias/locais não encontrados com atalho para cadastrá-los (o importador **não** cria nada sozinho). (3) "Importar" só habilitado com `podeConfirmar`, reenviando o **mesmo `File`** com o `hashArquivo`; opção secundária, com confirmação explícita, "Importar só as válidas". Trocar arquivo ou local padrão invalida o relatório. Use `FormData` sem definir `Content-Type`; trate os `400` com `error` (inclusive "aspas não fechadas na linha N" e hash divergente) e mostre progresso durante a confirmação. Só `admin`/`operador` veem a tela.

**Etapa 7 — Inventários** (spec 2.1): lista paginada com filtros (status, busca) e selo de status; criar/editar em rascunho (nome, descrição, **escopo** por seleção de locais na árvore — sublocais entram automaticamente —, **equipe** com autocomplete de usuários vinculados à empresa); detalhe com escopo, equipe e totais; ações por status: "Iniciar" (congela o esperado; mostrar `totalEsperados` e avisar que é irreversível), "Cancelar", "Excluir" (só rascunho/cancelado, `admin`). Tela somente leitura quando concluído/cancelado. Só `admin`/`operador` veem botões de escrita.

**Etapa 8 — Leituras** (spec 2.2): dentro do inventário em andamento, tela de contagem com campo de plaqueta focado (Enter registra, leitor de código de barras/teclado), seletor de local persistente entre leituras, feedback imediato da leitura (usar `GET .../leituras/info?plaqueta=` para avisar "esperado em outro local"/"desconhecida"), lista paginada de leituras com filtros e anulação (com confirmação). Importação de leituras por CSV em duas fases (validar → confirmar), no mesmo molde da Etapa 6. Usuário fora da equipe (e não `admin`) vê a tela em modo leitura e trata o `403` com a mensagem do servidor. Gere um `clientId` por tentativa e reutilize-o em reenvios.

**Etapa 9 — Conciliação, divergências e painel** (specs 2.3 e 2.4): (1) painel do inventário (`GET .../painel`): barra de progresso, contadores por situação, tabela de progresso por local e lista da equipe, com atualização periódica (30–60 s) enquanto `em_andamento`. (2) tela de conciliação com filtros (situação, local, busca, **Pendentes/Resolvidas**), cores por situação, ícone discreto para leituras repetidas. (3) modal de decisão por divergência (`ajustar_local` com seletor restrito aos `locaisLidos`, ou `manter`, observação), com "Reabrir" só para `manter`, selo "decisão desatualizada" e `duplicado` decidido só por `admin` (tratar `403`). Tudo desabilitado fora de `em_andamento`.

**Etapa 10 — Encerramento e relatório** (spec 2.5): botão "Encerrar inventário" (só `admin`, só `em_andamento`) com diálogo de confirmação irreversível; se houver pendências, mostrar a contagem e exigir confirmação extra antes de reenviar com `confirmarPendencias: true`. Inventário concluído em modo somente leitura, exibindo quem encerrou, quando e as pendências no encerramento. Botões "Baixar PDF" e "Baixar CSV" (blob via interceptor, nome do arquivo pelo `Content-Disposition`), com aviso de "resultado parcial" quando não concluído.

## Qualidade
- Componentes pequenos e reutilizáveis (tabela paginada, seletor de local em árvore, autocomplete de responsável) em vez de copiar/colar entre telas.
- Estados completos em toda tela: carregando, vazio, erro, sucesso; formulários com validação, desabilitando o botão durante o envio.
- Testes no padrão do projeto para: interceptor (header, exceções, `403`), serviço de empresa ativa, guards, e os fluxos críticos de cada etapa (inclusive "usuário `leitura` não vê botões de escrita").
- Acessibilidade básica (labels, foco em diálogos, navegação por teclado na árvore).

## Regras de trabalho
- Antes de editar, mostre um **plano curto** da etapa. Commits pequenos e em português no estilo do histórico (`feat:`, `fix:`...), **sem push** e sem mexer na branch principal.
- Não altere nada fora da área Imobilizado, exceto o estritamente necessário (menu/rotas). Se precisar, diga o quê e por quê.
- Se faltar um endpoint ou campo que a tela precisa, **não invente**: liste o que falta para eu pedir ao backend.
- Ao terminar cada etapa, reporte o resultado real de build/lint/testes (incluindo falhas) e o que ficou pendente.

Comece pela exploração do frontend existente e me apresente o resumo e o plano da Etapa 1.
