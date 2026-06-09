# Manual do Usuário — ControleEstoque

> Guia de uso do sistema de controle de estoque: o que cada área faz, quem pode usá-la e como realizar as tarefas do dia a dia.

---

## 1. Introdução

O **ControleEstoque** é um sistema para gerenciar o estoque de uma empresa de ponta a ponta: cadastro de produtos e parceiros (fornecedores/clientes), lançamento de notas fiscais, registro de entradas e saídas de mercadoria, controle de lotes com validade, pedidos de compra, conferência de posição de estoque, análises de giro e curva ABC, alertas automáticos e relatórios em PDF.

### Conceitos-chave

| Termo | Significado |
|---|---|
| **Saldo** | Quantidade atual de um produto em estoque, calculada a partir de todas as movimentações registradas |
| **Movimentação** | Todo evento que altera o saldo de um produto: entrada, saída ou ajuste |
| **Conferência** | Visão consolidada da posição de estoque (saldo de todos os produtos em um momento) |
| **Lote** | Sublote de um produto com número e validade próprios — usado para itens perecíveis ou com rastreabilidade |
| **CMP** | Custo Médio Ponderado — preço médio de aquisição de um produto, recalculado a cada entrada |

---

## 2. Acessando o sistema

### Login e sessão

- Entre com **e-mail e senha** cadastrados. O sistema retorna um token de acesso (válido por tempo limitado) e um token de atualização (*refresh token*).
- Quando o token de acesso expirar, use o token de atualização para obter um novo, sem precisar digitar a senha novamente.
- **Sair (logout)** revoga o token de atualização — depois de sair, é necessário fazer login de novo.
- **Esqueci minha senha**: solicite a recuperação informando seu e-mail; você receberá um link/código para definir uma nova senha.

### Meu perfil

Cada usuário pode visualizar e atualizar seus próprios dados em "Meu perfil" (nome, e-mail, senha), sem depender de um administrador.

### Perfis de acesso

O sistema possui três perfis. As permissões são cumulativas — `admin` pode tudo que `operador` pode, e `operador` pode tudo que `leitura` pode, salvo indicação em contrário.

| Perfil | O que pode fazer |
|---|---|
| **leitura** | Consultar cadastros, movimentações, saldo, conferência, dashboard, lotes e pedidos de compra. Não pode criar, editar nem excluir nada. |
| **operador** | Tudo que `leitura` pode, **mais**: cadastrar e editar produtos, fornecedores, clientes e lotes; lançar notas fiscais e movimentações; criar e gerenciar pedidos de compra; gerar alertas manuais; emitir relatórios. |
| **admin** | Acesso total: tudo que `operador` pode, **mais**: gerenciar categorias, usuários e seus perfis; editar/excluir movimentações e lotes; excluir cadastros (soft delete); consultar logs de auditoria. |

> Itens excluídos não somem do banco — ficam marcados como removidos (*soft delete*) e deixam de aparecer nas consultas e relatórios.

---

## 3. Cadastros

### Categorias *(gestão restrita a admin)*

Agrupam produtos (ex.: "Bebidas", "Limpeza"). Toda consulta e listagem é liberada a todos os perfis; criar, editar e excluir é exclusivo do `admin`.

### Produtos

Cada produto tem:

| Campo | Observação |
|---|---|
| **SKU** | Código único do produto — não pode haver dois produtos com o mesmo SKU |
| **Nome / Descrição** | Identificação do item |
| **Categoria** | Vínculo obrigatório com uma categoria existente |
| **Preço unitário** | Valor de referência (não pode ser negativo) |
| **Estoque mínimo** | Quantidade abaixo da qual o produto é considerado em alerta |
| **Ponto de reposição** | Quantidade que dispara a sugestão de "comprar mais" |
| **Faz parte do estoque** | Permite cadastrar itens que não entram no cálculo de saldo (ex.: serviços) |

### Fornecedores

Cadastro com **CNPJ** (14 dígitos), razão social, nome fantasia, contato e endereço.

- **Consulta automática por CNPJ**: ao informar o CNPJ de um fornecedor novo, o sistema busca os dados públicos da empresa (Receita Federal) e preenche razão social, endereço etc. automaticamente — basta conferir e salvar.

### Clientes

Cadastro de **pessoa física (CPF)** ou **jurídica (CNPJ)**, com nome, contato e endereço.

### Preenchimento automático de endereço por CEP

Ao cadastrar fornecedor ou cliente, informe o **CEP** e o sistema preenche automaticamente logradouro, município e UF.

---

## 4. Notas fiscais

Toda nota fiscal lançada **gera automaticamente as movimentações de estoque** correspondentes aos seus itens — você não precisa lançar a NF e depois lançar a movimentação manualmente.

### Lançamento manual

Informe: número, série, tipo (`entrada` ou `saída`), dados do fornecedor (nome e CNPJ — ou vínculo com um fornecedor já cadastrado), data de emissão, valor total e a lista de itens (produto, quantidade e valor unitário). O sistema cria a NF e todas as movimentações dos itens em uma única operação — se algo falhar, nada é gravado.

### Importação de XML de NF-e

1. **Analisar**: envie o arquivo XML da NF-e para o sistema gerar uma prévia — você confere fornecedor, itens e valores antes de confirmar.
2. **Importar**: confirmando a prévia, a NF e as movimentações são criadas automaticamente a partir dos dados do XML, sem necessidade de digitação manual.

> O sistema valida o arquivo contra ataques comuns em XML (entidades externas), então XMLs malformados ou suspeitos são rejeitados com uma mensagem de erro.

---

## 5. Movimentações de estoque

Toda alteração de saldo passa por uma movimentação. Os tipos disponíveis são:

| Tipo | Efeito no saldo | Quando usar |
|---|---|---|
| **entrada** | Aumenta o saldo | Recebimento de mercadoria (compra, devolução de cliente etc.) |
| **saída** | Reduz o saldo | Venda, consumo interno, remessa |
| **ajuste** | Aumenta o saldo | Correção para mais (ex.: contagem encontrou mais itens do que o sistema registrava) |
| **ajuste_saída** | Reduz o saldo | Correção para menos (quebra, perda, vencimento, erro de lançamento) |

Ao registrar um **ajuste** ou **ajuste_saída**, é obrigatório informar o **motivo**: `inventario`, `quebra`, `furto`, `vencimento`, `erro_lancamento`, `devolucao` ou `outro`.

### Regras importantes

- Não é possível registrar **saída** ou **ajuste_saída** maior do que o saldo disponível — o sistema bloqueia e avisa "saldo insuficiente".
- A **quantidade** deve ser maior que zero e o **valor unitário** não pode ser negativo.
- Você pode vincular a movimentação a um **lote** específico (ver seção 6) e/ou a um **item de pedido de compra** — neste último caso, apenas movimentações do tipo `entrada` podem ser vinculadas, e o sistema atualiza automaticamente a quantidade recebida do pedido.
- Movimentações antigas podem ser **editadas ou estornadas (excluídas)**, mas essa ação é restrita a `admin` — e o sistema sempre recalcula o saldo para garantir consistência.

### Consultas disponíveis

- **Saldo atual** de qualquer produto.
- **Histórico de preço médio (CMP)**: evolução mês a mês do custo médio ponderado de um produto, útil para acompanhar variação de preços de compra.
- Filtros por produto, nota fiscal, período etc., com **exportação em CSV**.

---

## 6. Lotes e validade

Funcionalidade **opcional**: produtos sem necessidade de rastreabilidade continuam funcionando normalmente sem usar lotes.

Use lotes quando precisar controlar **validade** ou **rastreabilidade** de itens perecíveis (alimentos, medicamentos, cosméticos etc.).

### Cadastro de um lote

Informe: produto, **número do lote** (único por produto), datas de fabricação e validade (a validade não pode ser anterior à fabricação), quantidade inicial e, opcionalmente, o fornecedor de origem.

### Como funciona na prática

- Ao registrar uma movimentação de **entrada** ou **saída**, você pode informar o lote correspondente — o sistema confere se o lote pertence ao produto informado e, em saídas, se há saldo suficiente *naquele lote*.
- A quantidade atual do lote é ajustada automaticamente a cada movimentação vinculada a ele, da mesma forma que o saldo do produto.
- Um lote só pode ser **excluído** quando sua quantidade atual chegar a zero (admin).

### Consultas

- Listagem de lotes com filtros por produto, **vencidos** ou **a vencer**.
- Atalho **"lotes vencendo em N dias"** para acompanhamento de validade próxima — útil para planejar promoções ou descarte antes do vencimento.

---

## 7. Pedidos de compra

Use para planejar e acompanhar reposições de estoque junto a fornecedores.

### Ciclo de vida

1. **Criar** o pedido com uma descrição, opcionalmente destinado a um usuário responsável, e a lista de itens (produto + quantidade solicitada). O pedido nasce com status **"aberto"**.
2. **Adicionar ou remover itens** enquanto o pedido estiver em aberto.
3. **Vincular o recebimento**: ao lançar uma movimentação de entrada, é possível associá-la a um item do pedido — o sistema atualiza automaticamente a quantidade recebida.
4. **Cancelar**: um pedido pode ser cancelado a qualquer momento (exceto se já cancelado).

> Pedidos cancelados não podem receber novos itens nem novas movimentações vinculadas.

### Relatório

É possível gerar um **PDF do pedido de compra** para impressão ou envio ao fornecedor.

---

## 8. Conferência de estoque

A área de conferência reúne quatro visões complementares do estoque:

### Posição de estoque

Mostra o **saldo atual** de todos os produtos: quantidade, valor em estoque (saldo × custo médio) e indicadores de alerta.

- **Sugestões de reposição**: lista de produtos cujo saldo está igual ou abaixo do ponto de reposição cadastrado — ajuda a decidir o que comprar, podendo ser filtrada por categoria.
- **Exportação em CSV**: baixe a posição de estoque para análise em planilhas.
- **Relatório em PDF**: gere um documento formatado da conferência para arquivamento ou apresentação.

### Giro de estoque

Mostra **com que frequência cada produto está sendo consumido** em relação ao seu estoque médio no período.

| Situação | O que significa | O que fazer |
|---|---|---|
| Giro **alto** (ex.: > 2) | Produto sai rápido — risco de ruptura | Garantir reposição frequente |
| Giro **baixo** (ex.: < 0.5) | Produto está parado — capital empatado | Avaliar promoção, liquidação ou redução de compras |
| Giro **"—"** | Sem movimentação no período | Produto inativo — avaliar descontinuação |

**Como usar:** acesse com a janela de tempo desejada (padrão: últimos 12 meses), filtre por categoria se necessário, e use a ordenação "parados primeiro" para identificar rapidamente os produtos que estão ocupando espaço e capital sem girar. Exporte em CSV para compartilhar com a equipe de compras.

### Curva ABC

Classifica os produtos em três grupos com base no **valor total movimentado** no período:

| Classe | Significado | Atenção |
|---|---|---|
| **A** | Poucos produtos que representam ~80% do valor | Alta prioridade — qualquer ruptura impacta fortemente o resultado |
| **B** | Produtos intermediários que chegam a ~95% do valor | Atenção moderada |
| **C** | Maioria dos produtos, mas representam apenas ~5% do valor | Menor prioridade operacional |

**Como usar:** a curva ABC ajuda a decidir **onde focar esforço de compras e controle**. Produtos da classe A merecem estoque de segurança mais generoso e acompanhamento mais próximo; produtos da classe C podem ter políticas de reposição menos frequentes. Filtre por classe para ver apenas o grupo de interesse, e exporte em CSV para relatórios gerenciais.

---

## 9. Painel (dashboard) e alertas

### Dashboard

Resumo executivo com os principais indicadores:

- Total de produtos cadastrados
- Valor total em estoque
- Quantidade de produtos abaixo do estoque mínimo
- Quantidade de produtos com reposição pendente
- Movimentações realizadas no dia

> Os dados do painel ficam em cache por alguns segundos — pequenas variações entre uma atualização e outra são normais.

### Alertas de estoque baixo

- **Automático**: todos os dias, o sistema verifica os produtos abaixo do estoque mínimo e envia um e-mail de alerta para o endereço configurado.
- **Manual**: a qualquer momento, é possível disparar esse alerta imediatamente (por exemplo, após uma conferência), informando ou não um e-mail de destino alternativo.

---

## 10. Relatórios em PDF

A área de **Impressões** centraliza a geração de relatórios formatados, prontos para impressão ou compartilhamento:

| Relatório | Conteúdo |
|---|---|
| Pedido de compra | Detalhes de um pedido específico |
| Movimentações | Lista de movimentações filtradas por período/produto/tipo |
| Conferência de estoque | Posição consolidada do estoque |
| Nota fiscal | Detalhes de uma NF específica |
| Relatório de notas fiscais | Lista de notas filtradas |
| Clientes | Lista de clientes filtrada (tipo, UF, situação) |
| Fornecedores | Lista de fornecedores filtrada (UF, situação) |

> O sistema mantém um **histórico de impressões geradas**, consultável por quem tem permissão de gerar relatórios.

---

## 11. Auditoria *(restrito a admin)*

Toda ação relevante realizada no sistema (criação, edição, exclusão) fica registrada em um **log de auditoria**: quem fez, o quê, quando e em qual registro. Use essa tela para investigar alterações inesperadas ou conferir o histórico de um usuário/registro específico.

---

## 12. Passo a passo de tarefas comuns

### Recebendo mercadoria de um fornecedor

1. Confirme se o fornecedor está cadastrado (ou cadastre-o, aproveitando a busca automática por CNPJ).
2. Lance a **nota fiscal de entrada** com os itens recebidos — as movimentações de entrada são geradas automaticamente.
3. Se o produto usa controle de lote, registre o lote recebido (número, validade, quantidade) e vincule as movimentações a ele.
4. Se o recebimento atende a um pedido de compra em aberto, vincule as movimentações ao item correspondente para que a quantidade recebida seja atualizada.

### Registrando uma saída/venda

1. Verifique o saldo disponível do produto (o sistema bloqueia saídas maiores que o saldo).
2. Lance a movimentação do tipo **saída**, informando produto, quantidade e valor — e o lote, se aplicável.
3. Se a saída tiver origem em uma nota fiscal, lance a NF de saída — as movimentações são criadas automaticamente.

### Cadastrando um produto com controle de lote

1. Cadastre o produto normalmente (categoria, preço, estoque mínimo, ponto de reposição).
2. Ao receber a primeira remessa, cadastre o **lote** com número e validade.
3. A partir daí, vincule todas as movimentações de entrada/saída desse produto ao lote correspondente, mantendo a rastreabilidade.

### Fazendo a conferência periódica de estoque

1. Acesse a tela de **conferência** e revise a posição atual de cada produto.
2. Compare com a contagem física; havendo diferença, registre um **ajuste** (a maior) ou **ajuste_saída** (a menor), sempre informando o motivo.
3. Confira as **sugestões de reposição** e, se necessário, abra um **pedido de compra**.
4. Gere o **relatório em PDF** ou exporte em **CSV** para arquivamento.

### Identificando produtos problemáticos com giro e curva ABC

1. Acesse **Giro de Estoque** (painel de conferência) com o período do último trimestre ou semestre.
2. Ordene por "parados primeiro" — os itens no topo têm capital empatado sem rotatividade. Avalie liquidação, promoção ou suspensão de novas compras.
3. Acesse **Curva ABC** e filtre por **Classe A** — esses são os produtos críticos. Verifique se todos têm estoque de segurança adequado e reposição planejada.
4. Exporte ambas as análises em CSV para compartilhar com compras e financeiro.

---

## 13. Dúvidas frequentes

**"Saldo insuficiente para esta operação"**
A quantidade de saída (ou ajuste de saída) é maior que o saldo atual do produto — ou do lote, se um lote foi informado. Confira o saldo antes de lançar a movimentação.

**"SKU já cadastrado" / "Número de lote já existe para este produto"**
Cada produto precisa de um SKU único no sistema, e cada lote precisa de um número único *dentro do mesmo produto*. Verifique se o item já não está cadastrado.

**"Não é possível excluir: quantidade atual diferente de zero"**
Lotes só podem ser removidos quando totalmente consumidos/zerados. Movimente o saldo do lote a zero antes de excluí-lo.

**Não consigo editar/excluir uma movimentação ou lote**
Essas ações são restritas ao perfil `admin`. Procure um administrador do sistema.

**Um item que eu exclui ainda existe no banco?**
Sim — exclusões são "suaves" (*soft delete*): o registro fica marcado como removido, mas não aparece mais em nenhuma consulta, relatório ou cálculo de saldo.

**Recebi um erro genérico "Ocorreu um erro inesperado"**
Isso indica um problema interno. Anote a hora exata e o que estava fazendo, e acione o suporte técnico — o erro fica registrado nos logs do sistema para investigação.
