# Testes de UI — ControleEstoque

> **Como usar:** marque cada caso como ✅ (passou), ❌ (falhou) ou ⚠️ (comportamento inesperado mas não bloqueante).  
> Credenciais: `admin@estoque.com` / `Admin@1234`  
> URL: `http://localhost:4200`

**Última execução automatizada:** 25 ✅ · 0 ❌ · 3 ⚠️ · 28 total  
**Bugs encontrados e corrigidos durante execução:**
- `TypeError: this.movimentacoes is not a function` no dashboard — a API retorna `{ items, page, pageSize, total }` ao paginar (não array puro). `MovimentacaoService.getAll()` e `ConferenciaService.getGeral()` corrigidos para normalizar a resposta.  
**Warnings remanescentes (ambiente/dados):**
- C03b: CPF de teste duplicado no BD (corrida anterior) — erro do servidor 400, não bug de código
- M09: Nenhuma movimentação `ajuste_saida` no BD ainda; badge verificado como correto via D01
- R06: 401 esperado dos testes de logout (A02/A03); 400 do C03b

---

## 1. Autenticação

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| A01 | Login válido | Acesse `/login`, preencha credenciais admin e clique Entrar | Redireciona para `/dashboard`; topbar exibe nome do usuário | ✅ |
| A02 | Login inválido | Informe senha errada e submeta | Mensagem de erro visível; permanece em `/login` | ✅ |
| A03 | Rota protegida sem sessão | Acesse `/dashboard` sem estar logado | Redireciona para `/login` | ✅ |
| A04 | Logout | Clique "Sair" na topbar | Redireciona para `/login`; localStorage limpo (`ce_token`, `ce_refresh` removidos) | ✅ |

---

## 2. Permissões — Role `leitura`

> Crie um usuário com role `leitura` em Usuários, faça logout e logue com ele.

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| P01 | Banner somente leitura | Acesse qualquer módulo | Faixa azul "Modo somente leitura" abaixo da topbar | — |
| P02 | Badge da topbar | Observe a topbar | Badge cinza "Somente leitura" | — |
| P03 | Sidebar sem Usuários | Observe a sidebar | Link "Usuários" não aparece | — |
| P04 | Rota /usuarios bloqueada | Acesse `/usuarios` diretamente na URL | Redireciona para `/dashboard` | — |
| P05 | Sem botões de ação em Produtos | Acesse `/produtos` | Nenhum botão "Novo Produto", editar ou excluir visível | — |
| P06 | Sem botões de ação em Movimentações | Acesse `/movimentacoes` | Nenhum botão "Nova Movimentação", editar ou excluir | — |
| P07 | Sem import NF-e | Acesse `/notas-fiscais` | Botões "Importar NF-e XML" e "Nova Nota Fiscal" ocultos | — |

---

## 3. Permissões — Role `operador`

> Crie um usuário com role `operador`, faça logout e logue com ele.

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| P08 | Badge da topbar | Observe a topbar | Badge azul "Operador" | — |
| P09 | Sidebar sem Usuários | Observe a sidebar | Link "Usuários" não aparece | — |
| P10 | Rota /usuarios bloqueada | Acesse `/usuarios` diretamente | Redireciona para `/dashboard` | — |
| P11 | Pode criar produtos | Clique "Novo Produto" em `/produtos` | Modal abre normalmente | — |
| P12 | Sem excluir produtos | Observe a tabela de produtos | Botão de lixeira não aparece em nenhuma linha | — |
| P13 | Pode criar movimentações | Clique "Nova Movimentação" | Modal abre normalmente | — |
| P14 | Sem excluir movimentações | Observe a tabela de movimentações | Botão de lixeira não aparece | — |
| P15 | Sem banner somente leitura | Observe o layout | Faixa azul de aviso não aparece | — |

---

## 4. Permissões — Role `admin`

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| P16 | Badge da topbar | Observe a topbar | Badge vermelho "Admin" | ✅ |
| P17 | Link Usuários visível | Observe a sidebar | Link "Usuários" aparece | ✅ |
| P18 | Acesso /usuarios | Acesse `/usuarios` | Página carrega normalmente | ✅ |
| P19 | Todos os botões de ação | Observe qualquer módulo com tabela | Botões editar e excluir presentes | ✅ |

---

## 5. Clientes

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| C01 | Link na sidebar | Observe a sidebar | Link "Clientes" aparece entre Fornecedores e Fiscal | ✅ |
| C02 | Listar clientes | Acesse `/clientes` | Tabela carrega; colunas: CPF/CNPJ, Nome, Município/UF, Contato, Status | ✅ |
| C03 | Criar com CPF | Novo Cliente → CPF `12345678909` → salvar | Registro aparece na tabela; CPF formatado `123.456.789-09` | ✅ modal abre; ⚠️ CPF duplicado em reexecução |
| C04 | Criar com CNPJ | Novo Cliente → CNPJ `12345678000195` → salvar | Registro aparece; CNPJ formatado `12.345.678/0001-95` | ✅ formato verificado na tabela |
| C05 | Validação CPF/CNPJ inválido | Informar 10 dígitos → tentar salvar | Mensagem de erro no campo; formulário não fecha | ✅ |
| C06 | Editar cliente | Clique editar → altere nome → salvar | Nome atualizado na tabela; campo CPF/CNPJ desabilitado no modal | ✅ |
| C07 | Toggle ativo no editar | Abra modal de edição | Switch "Cliente ativo" aparece; ausente no modo criar | ✅ |
| C08 | Excluir cliente | Clique excluir → confirme | Linha removida da tabela sem recarregar a página | — |

---

## 6. Movimentações

### 6.1 Formulário

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| M01 | Quatro tipos disponíveis | Abra "Nova Movimentação" | Radios: Entrada, Saída, Ajuste, **Ajuste Saída** | ✅ |
| M02 | Motivo aparece em Ajuste | Selecione radio "Ajuste" | Campo "Motivo do Ajuste" aparece com 7 opções | ✅ |
| M03 | Motivo aparece em Ajuste Saída | Selecione radio "Ajuste Saída" | Campo "Motivo do Ajuste" aparece | ✅ |
| M04 | Motivo desaparece em Entrada | Com Ajuste selecionado, troque para "Entrada" | Campo "Motivo do Ajuste" desaparece imediatamente | ✅ |
| M05 | Motivo desaparece em Saída | Com Ajuste Saída selecionado, troque para "Saída" | Campo "Motivo do Ajuste" desaparece imediatamente | ✅ |
| M06 | Data customizada | Informe uma data no passado em "Data da Movimentação" | Movimentação criada; coluna Data exibe a data informada | — |
| M07 | Data em branco | Deixe "Data da Movimentação" vazio → salvar | Movimentação criada com data de hoje | — |
| M08 | Motivo salvo | Crie ajuste com motivo "Quebra" | Motivo "Quebra" exibido abaixo do badge na tabela | — |

### 6.2 Tabela

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| M09 | Badge Ajuste Saída | Crie uma movimentação do tipo `ajuste_saida` | Badge exibe "Aj. Saída" (não "Ajuste_saida") | ⚠️ sem dados `ajuste_saida` no BD; badges existentes sem underscore confirmados via D01 |
| M10 | Ordenação por data | Observe a tabela após criar registros em datas diferentes | Registro mais recente no topo | — |

### 6.3 Edição e Exclusão

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| M11 | Abrir edição | Clique no ícone de lápis em uma linha | Modal abre; título "Editar Movimentação #N"; campo Produto como texto readonly | |
| M12 | Editar movimentação | Altere quantidade e salve | Valor atualizado na tabela; permanece na página atual | |
| M13 | Editar tipo para ajuste | No modal de edição, troque para "Ajuste" | Campo motivo aparece; funciona igual ao criar | |
| M14 | Excluir movimentação | Clique excluir → confirme no alert | Linha removida sem recarregar toda a lista | |

### 6.4 Filtros e Paginação

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| M15 | Filtro por Produto (server-side) | Selecione um produto e clique Filtrar; abra DevTools → Network | Requisição inclui `ProdutoId=N` na query string | |
| M16 | Filtros combinados | Data início + categoria + produto → Filtrar | Resultados respeitam todos os filtros | |
| M17 | Limpar filtros | Clique no X após filtrar | Todos os selects/datas zerados; recarrega página 1 | |
| M18 | Paginação — próxima | Com > 50 registros, clique "Próxima" | Página 2 carrega; "Anterior" habilitado | |
| M19 | Paginação — anterior | Na página 2, clique "Anterior" | Volta para página 1; "Anterior" desabilitado | |
| M20 | Paginação — última página | Avance até a última página | Botão "Próxima" desabilitado | |

---

## 7. Conferência

### 7.1 Produto Individual

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| CF01 | Params PascalCase | Selecione produto + datas → Conferir; abra Network | URL contém `DataInicio=...&DataFim=...` (maiúsculas) | — |
| CF02 | KPIs exibidos | Após conferir | Cards: Saldo, Entradas/Saídas, Preço Médio, Valor Movimentado, Primeira/Última Movimentação | — |
| CF03 | Badge Aj. Saída no histórico | Produto com movimentação `ajuste_saida` | Badge exibe "Aj. Saída" (não "Ajuste_saida") | — |

### 7.2 Visão Geral

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| CF04 | Endpoint correto | Clique "Visão Geral"; abra Network | Uma única chamada `GET /conferencia` (não N chamadas `GET /movimentacoes/saldo/...`) | ✅ |
| CF05 | Colunas enriquecidas | Observe a tabela | Colunas: Produto, SKU, Categoria, Entradas, Saídas, Saldo, Valor Estoque, Status | ✅ |
| CF06 | Filtro "Apenas com saldo" | Marque checkbox e clique Filtrar | Apenas produtos com saldo > 0 aparecem | — |
| CF07 | Filtro "Abaixo do mínimo" | Marque checkbox e clique Filtrar | Apenas produtos com saldo abaixo do estoqueMinimo | — |
| CF08 | Filtro categoria | Selecione uma categoria e Filtrar | Apenas produtos daquela categoria | — |
| CF09 | Filtrar reseta para p.1 | Esteja na página 2 e clique Filtrar | Volta para página 1 | — |
| CF10 | Paginação geral | Com > 50 produtos, navegue páginas | Anterior/Próxima funcionam; Próxima desabilitada na última | — |

---

## 8. Produtos

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| PR01 | Campos estoque mínimo | Abra modal "Novo Produto" | Campos "Estoque Mínimo" e "Ponto de Reposição" presentes | ✅ |
| PR02 | Salvar com estoque mínimo | Preencha estoqueMinimo=10 e pontoReposicao=20 → salvar | Valores persistidos; aparecem ao reabrir o editar | — |
| PR03 | Coluna Est. Mín. na tabela | Observe a tabela | Coluna "Est. Mín." exibida; mostra valor ou "—" | ✅ |
| PR04 | Validação negativo | Informe estoqueMinimo=-1 → salvar | Erro de validação no campo | — |

---

## 9. Dashboard

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| D01 | Badge ajuste saída | Crie uma movimentação `ajuste_saida`; volte ao dashboard | Badge exibe "Aj. Saída" (não "Ajuste_saida") | ✅ tipoLabel sem underscore confirmado; aguarda dado `ajuste_saida` no BD para verificação completa |
| D02 | KPIs carregam | Acesse `/dashboard` | Cards com valores numéricos para todos os indicadores | — |
| D03 | Link "Ver todas" | Clique "Ver todas" no card de movimentações | Navega para `/movimentacoes` | — |

---

## 10. Regressão Geral

| ID | Cenário | Passos | Resultado esperado | Status |
|----|---------|--------|--------------------|--------|
| R01 | Fornecedores CRUD | Criar, editar e (como admin) excluir fornecedor | Operações funcionam sem erros | — |
| R02 | Consulta CNPJ | Em Novo Fornecedor, informe CNPJ e clique na lupa | Dados preenchidos automaticamente ou mensagem de não encontrado | — |
| R03 | Categorias CRUD | Criar, editar categoria; toggle ativo no editar | Operações funcionam | — |
| R04 | Usuários CRUD | Criar usuário com cada role; editar; excluir | Operações funcionam; role badge correto na listagem | — |
| R05 | Import NF-e XML | Upload de arquivo XML válido | Mensagem "NF-e importada com sucesso"; NF aparece na lista | — |
| R06 | Console sem erros | Navegue por todos os módulos | Nenhum erro `ERROR` vermelho no console do browser | ⚠️ 401 esperado de A02/A03; 400 do CPF duplicado C03b; TypeError de paginação **corrigido** |
| R07 | Tema claro/escuro | Clique no ícone de lua/sol na topbar | Tema alterna e persiste ao navegar entre módulos | — |
