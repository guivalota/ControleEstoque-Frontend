# Manual do Financeiro

O módulo Financeiro controla o que a empresa **tem a pagar** e **tem a receber**, registra os pagamentos e recebimentos (baixas) e mostra o caixa previsto e o realizado. Ele é gerencial: não emite boleto nem lê extrato de banco.

## 1. Antes de começar: os cadastros

Em **Financeiro › Cadastros** (precisa da permissão de editar cadastros do financeiro, normalmente o Administrador):

- **Contas** — o caixa e os bancos da empresa. Informe o **saldo inicial** e a **data** a que ele se refere: o fluxo de caixa parte daí. Não guarde dado bancário sensível.
- **Categorias** — o plano gerencial, em até 3 níveis (por exemplo, *Despesas › Aluguel › Sede*). Toda categoria é de **receita** ou **despesa**; a subcategoria herda a natureza da categoria de cima.
- **Centros de custo** — agrupam os lançamentos por área ou projeto (opcional em cada título).
- **Configurações** — o valor a partir do qual um pagamento exige aprovação, o prazo padrão de vencimento e a categoria dos pagamentos importados.

Conta, categoria ou centro que já tem título **não pode ser excluído**: inative.

## 2. Lançar um título

**Financeiro › Títulos › Novo título.** Escolha **a pagar** (usa fornecedor e categoria de despesa) ou **a receber** (usa cliente e categoria de receita). Se a pessoa não está no cadastro, digite só o nome.

- **Valor** sempre positivo, com até 2 casas. **Vencimento** é obrigatório; a **competência** (mês a que o gasto ou a venda pertence) é, por padrão, o mês da emissão.
- Enquanto o título não tem baixa, você pode alterar tudo; cada mudança fica no **histórico**. Depois da primeira baixa, **valor, pessoa e tipo ficam bloqueados** (vencimento e categoria continuam editáveis).
- **Cancelar** exige um motivo e só vale para título sem baixa. Se já houve baixa, estorne antes.
- A lista mostra em vermelho o que **venceu** (calculado pela data de São Paulo) e filtra por tipo, situação, vencimento, categoria, centro de custo e texto.

### Parcelar

Marque **Parcelar este lançamento**, informe o valor **total**, o número de parcelas (2 a 60) e o vencimento da primeira. O sistema gera uma parcela por mês; a soma é sempre exata (a última parcela ajusta os centavos). A tela mostra as parcelas antes de gerar. As parcelas ficam ligadas: na lista, **ver todas** mostra o grupo.

### Contas fixas

**Financeiro › Contas fixas** guarda o que se repete todo mês (aluguel, assinatura, mensalidade). Informe o dia do vencimento (em meses curtos vale o último dia), quando começa e, se quiser, quando termina. O sistema gera os títulos dos próximos meses sozinho (por padrão, 3 meses à frente) e **nunca duplica**. Alterar a conta fixa vale para os títulos futuros; os já gerados não mudam. **Encerrar** para de gerar.

## 3. Pagar e receber (baixa)

Abra o título e use **Registrar pagamento** (ou recebimento). Informe conta, forma (PIX, boleto, transferência, dinheiro, cartão, outro), data, **valor**, **juros**, **multa** e **desconto**.

- O que **abate o saldo** é o valor mais o desconto. Juros e multa somam ao que saiu (ou entrou) na conta, mas não abatem o título.
- A baixa pode ser **parcial**: o título fica *Parcial* até o saldo zerar, quando vira *Quitado*.
- A data não pode ser futura e o valor mais o desconto não pode passar do saldo.

### Estornar

Quem tem a permissão de estornar (normalmente só o Administrador) pode **estornar uma baixa**, sempre com **motivo**. A baixa não some: fica marcada como estornada, o saldo do título volta e o histórico registra quem fez.

## 4. Aprovação de pagamento

Se a empresa definiu um valor mínimo para aprovação (em **Cadastros › Configurações**), todo título **a pagar** nesse valor ou acima nasce com um pedido de aprovação, e **só pode ser baixado depois de aprovado**.

- Quem decide é **outro administrador**, não quem lançou. Os pedidos aparecem em **Aprovações** e os administradores recebem aviso por e-mail.
- **Recusar** exige motivo e cancela o título.
- Se o **valor do título mudar** depois, a aprovação anterior é invalidada e um novo pedido é aberto (ou deixa de ser exigido, se o novo valor ficou abaixo do mínimo).
- Título a receber não exige aprovação.

## 5. Lançamentos que vêm do Estoque e da Produção

Quando a empresa tem o Financeiro ligado, uma **nota fiscal de entrada** do Estoque e um **retorno da terceirização** da Produção viram **contas a pagar** sozinhos (sem digitar duas vezes). O vencimento sai da emissão mais o prazo padrão da empresa, e a categoria é a configurada ou "Importados".

O que aconteceu **antes** de ligar o Financeiro não entra sozinho: aparece em **Financeiro › Importações**, onde o Administrador **importa** (podendo ajustar vencimento e categoria) ou **descarta**. Cada fato gera um título só.

## 6. Fluxo de caixa e relatórios

**Fluxo de caixa** mostra, por dia, semana ou mês, as entradas e saídas **previstas** (títulos em aberto, pelo vencimento) e **realizadas** (baixas), além do saldo das contas e o saldo **projetado**. Escolha uma conta para ver só o realizado dela. O gráfico tem uma tabela com os mesmos números.

**Relatórios** (período de até 366 dias):

- **Vencimentos** — o que vence no período.
- **Aging** — saldo em aberto por faixa de atraso (a vencer, 1–30, 31–60, 61–90 e mais de 90 dias) por fornecedor ou cliente.
- **Títulos por categoria** — previsto, realizado e em aberto por categoria.
- **Extrato por pessoa** — os títulos de um fornecedor ou cliente.

Exportar em **CSV** ou **PDF** exige a permissão de exportar (o perfil *Contador* tem).

## 7. Quem pode o quê

Cada empresa monta seus perfis em **Configurações › Perfis**. Nos perfis-modelo:

| Perfil | O que faz no Financeiro |
|---|---|
| Leitura | Consulta títulos, cadastros e relatórios |
| Operador | Leitura, mais lançar e editar títulos, parcelar, contas fixas e registrar baixas |
| Administrador | Tudo: estornar, cancelar, cadastros, importações e política de aprovação |
| Contador | Consulta tudo e exporta relatórios |

## 8. Limite do plano

O plano pode limitar quantos **títulos por mês** a empresa cria (inclusive os que vêm do Estoque, da Produção e das contas fixas). Ao atingir o limite, novos títulos são recusados com uma mensagem clara.
