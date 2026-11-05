# Manual da Produção

> Guia do módulo de produção para confecção: da ficha técnica à peça pronta, passando por corte, terceirização, custo e rastreio.

---

## 1. Sobre o módulo

O módulo **Produção** transforma materiais do estoque (tecido, aviamentos) em produto acabado, por tamanho e cor, e mostra **quanto custou** e **de qual rolo saiu cada peça**. Ele usa o cadastro e o saldo do **Estoque**: nada é cadastrado duas vezes, e tudo o que a produção consome ou gera aparece nas movimentações.

**O que ele faz**

- Guarda a **ficha técnica** de cada produto (o que entra em uma peça).
- Controla **ordens de produção** por tamanho, com reserva de material.
- Registra o **corte** do tecido, com aproveitamento e perda.
- Controla a **terceirização** (serviços feitos por terceiros, como a costura): remessas, retornos, defeitos e valor a pagar.
- Calcula o **custo** padrão (planejado) e o real (realizado).
- Sugere **o que comprar** para atender as ordens abertas.
- Faz o **rastreio por lote**, do rolo de tecido até o lote do produto acabado.
- Imprime **etiquetas** das peças e emite relatórios em tela, CSV e PDF.

**O que ele não faz (ainda)**

- Não tem roteiro de etapas nem apontamento de horas: a mão de obra vem da ficha técnica.
- Peças cortadas não geram saldo de semiacabado; ficam só como contagem por tamanho.
- O alerta de atraso aparece na tela, sem envio de e-mail.

### Onde fica o manual de cada módulo

Este manual cobre apenas a Produção. Cadastros, notas fiscais, movimentações, lotes e pedidos de compra estão no **manual do Estoque** (aba ao lado).

---

## 2. Quem pode fazer o quê

| Perfil | Na Produção |
|---|---|
| **leitura** | Consulta fichas, ordens, necessidade de materiais, terceirização, rastreio, relatórios e etiquetas. Não altera nada. |
| **operador** | Tudo que `leitura` faz, mais: criar fichas e ordens, liberar, iniciar, cortar, apontar, enviar peças a terceirizados e receber o retorno, gerar pedidos de compra. |
| **admin** | Igual ao `operador` na Produção. |
| **contador** | Não usa a Produção (como no Estoque). |

O módulo precisa estar contratado pela empresa. Sem ele, o menu **Produção** não aparece.

---

## 3. Conceitos-chave

**Material** — todo item de estoque que entra na peça: matéria-prima (tecido), aviamento (botão, zíper, etiqueta), embalagem, consumo. Cada item tem um **tipo** e uma **unidade** (m, un, kg...), definidos no cadastro de produtos.

**Grade** — tamanho e cor do produto acabado. Cada combinação (ex.: P / Branco) é uma **variação**, com SKU e saldo próprios. As ordens são lançadas **por tamanho**. As cores e os tamanhos disponíveis ficam em **Estoque → Grade (cores e tamanhos)**: ali você cria uma cor nova, renomeia, muda a ordem em que aparecem e **inativa** as que não usa mais (valor inativo some das próximas grades, mas as variações já criadas continuam). O código do valor não muda depois de criado, porque faz parte do SKU. Só o administrador cria ou inativa um eixo novo (por exemplo, Acabamento).

**Ficha técnica** — a "receita" do produto: quanto de cada material vai em uma peça, com **perda %** e valores de mão de obra e custos indiretos. Tem uma base comum e pode ter consumo próprio de uma variação (ex.: o tamanho G gasta mais tecido). É **versionada**: alterar cria uma nova versão e a anterior continua intacta.

**Ordem de produção** — o pedido de fabricar certas quantidades por tamanho. Fica presa à versão da ficha em que foi criada.

**Reserva** — ao liberar a ordem, o sistema separa o material necessário para ela, de modo que outra ordem não o use. Reserva não é baixa: o saldo só diminui no corte ou no apontamento.

**Custo padrão × custo real**

- **Padrão**: calculado na criação da ficha (materiais pelo custo médio da época + mão de obra + indiretos). É o planejado.
- **Real**: o que de fato foi gasto na ordem (insumos pelo custo médio ponderado do estoque, mão de obra e terceirização).
- Se faltar o custo de algum material, o sistema **avisa** em vez de assumir zero.

**Custo da peça que entra no estoque** — ao apontar (ou receber do terceirizado), a peça pronta entra no estoque já com o seu custo: materiais baixados + **tecido do corte** (rateado pelas peças cortadas) + **mão de obra** + **custos indiretos**. Quem opera pode alterar ou **zerar** a mão de obra e os indiretos em cada apontamento; a tela já sugere os valores da ficha.

**Preço de venda × custo** — o preço do cadastro do produto é só uma referência de venda e existe apenas para o que se vende (revenda, acabado e semiacabado). Material, aviamento, embalagem e consumo **não têm preço**: o custo deles vem das entradas de estoque. O **valor do estoque** do painel usa o custo médio, não o preço do cadastro.

**Terceirização** — serviço feito fora da empresa, como a costura numa confecção parceira, estamparia ou lavanderia. **Terceirizado** é quem executa. Na Produção, qualquer **fornecedor ativo** pode ser terceirizado.

---

## 4. Ciclo da ordem

`planejada` → `liberada` → `em produção` → `concluída` (ou `cancelada`)

| Estado | O que significa | O que acontece |
|---|---|---|
| **Planejada** | Criada, ainda não comprometeu material. | Pode ser cancelada sem efeito no estoque. |
| **Liberada** | Pronta para produzir. | O material é **reservado**. |
| **Em produção** | Corte e costura em andamento. | Aceita corte, terceirização e apontamento. |
| **Concluída** | Tudo foi apontado. | Fecha **sozinha** quando todas as peças são apontadas. |
| **Cancelada** | Interrompida, com motivo obrigatório. | A reserva é desfeita. |

Cada mudança de estado fica no **histórico** da ordem (quem e quando). Ordens canceladas continuam contando na cota mensal do plano.

---

## 5. Passo a passo

### Cadastrar uma ficha técnica

1. Cadastre antes, no Estoque, os materiais (tipo e unidade corretos) e o produto acabado, com a grade de tamanho e cor.
2. Em **Produção › Fichas técnicas**, escolha o produto e informe cada material com a quantidade **por peça** e a perda %.
3. Informe mão de obra e custos indiretos por peça.
4. Salve. Para ajustar depois, crie uma nova versão: as ordens antigas continuam com a versão em que nasceram.

### Criar e liberar uma ordem

1. **Ordens de produção › Nova ordem**: escolha o produto, o prazo e a quantidade por tamanho.
2. A tela mostra o material necessário e o saldo disponível.
3. Clique em **Liberar**. Se faltar material, o sistema mostra quanto falta e **só libera se você confirmar**; nesse caso, reserva o que existe.

### Cortar o tecido

1. Com a ordem em produção, abra **Corte** e escolha o tecido.
2. Informe o tecido usado, o retalho que sobrou, o número de camadas e quantas peças saíram por tamanho.
3. O sistema baixa o tecido (usado menos retalho) e mostra o **aproveitamento**, a perda real × prevista e as peças perdidas.

### Apontar a produção

1. Na ordem, **Apontar**: informe quantas peças ficaram prontas por tamanho.
2. O sistema baixa os materiais pela ficha e dá **entrada no estoque** do produto acabado, tudo de uma vez.
3. Se o consumo real for diferente do previsto, informe o **motivo**.
4. Confira a **mão de obra** e os **custos indiretos por peça**: vêm da ficha e entram no custo da peça que vai para o estoque. Altere ou deixe 0 para não considerar.
5. Apontar mais do que o planejado pede **confirmação** (sobreprodução).
6. Quando todas as peças forem apontadas, a ordem conclui sozinha.

> Material que já saiu no **corte** ou foi enviado para a **terceirização** não é baixado de novo no apontamento.

### Enviar peças para um terceirizado

1. **Terceirização › Nova remessa**: escolha a ordem, o terceirizado, as peças por tamanho, os aviamentos enviados, o preço por peça e o prazo.
2. Imprima o **romaneio** em PDF para acompanhar a carga.
3. A cada devolução, registre o **retorno** (parcial ou final), com as peças boas e as defeituosas. O valor a pagar considera as peças boas.
4. Para fechar uma remessa que não vai voltar completa, **encerre** o retorno: a diferença é registrada como perda.
5. O painel avisa remessas atrasadas (prazo combinado ou 15 dias).

### Saber o que comprar

Em **Necessidade de materiais**, o sistema soma o que as ordens abertas exigem, desconta o saldo e mostra o que **falta**. Defina o **fornecedor preferencial** de cada material e use **Gerar pedidos** para criar um pedido de compra por fornecedor.

### Rastrear um lote

1. Dê entrada no tecido **com lote** no Estoque.
2. Ao consumir, o sistema escolhe o lote (primeiro o que vence antes, depois o mais antigo).
3. O produto acabado entra no lote `OP-<número da ordem>`.
4. Na lista de **Lotes** (ícone de rastreio) ou no detalhe da ordem, veja o caminho nos dois sentidos: de qual rolo saiu a peça e onde foi usado cada rolo.

### Imprimir etiquetas

No detalhe da ordem concluída ou na grade do produto, escolha o modelo (**rolo 50 × 30 mm** ou **folha A4 com 21 etiquetas**) e imprima. Cada etiqueta traz nome, tamanho e cor, SKU e código de barras.

### Saber o preço mínimo de venda

Na **ficha técnica** do produto, o bloco **Preço mínimo sugerido** calcula o menor preço que ainda dá a margem que você quer:

`preço mínimo = custo da ficha ÷ (1 − margem − despesas de venda)`

1. Informe a **margem desejada (%)** e as **despesas de venda (%)** (impostos, comissão e outros custos que saem do preço) e salve.
2. O custo usa o **custo médio de hoje** dos materiais, então muda quando o preço de compra muda.
3. O sistema compara com o **preço de venda cadastrado** no produto e avisa se ele está abaixo do mínimo. Por exemplo: custo de R$ 20, margem de 40% e despesas de 10% dão um mínimo de R$ 40.

Em produto com **variações** (por exemplo, cor), o mínimo é calculado **para cada variação**, porque o material pode mudar de uma para outra (o couro marrom e o couro preto podem custar diferente).

Se faltar custo de algum material, o preço mínimo não é calculado (nunca assume zero). É só uma referência: o preço de venda continua sendo o do cadastro.

### Ver custos e resultados

Em **Relatórios**: custo real × padrão por ordem, produção por período, perda de tecido e ordens atrasadas. Exporte em CSV ou PDF (período de até 366 dias e 20.000 linhas). A **Visão geral** resume ordens por estado, atrasos, materiais a comprar e peças nos terceirizados.

---

## 6. Dúvidas frequentes

**Não consigo liberar a ordem.**
Falta material. A tela mostra quanto. Dê entrada no estoque, gere o pedido de compra, ou confirme a liberação com falta (reserva só o que existe).

**"Saldo insuficiente" ao apontar ou cortar.**
O material não está no estoque no momento. Confira o saldo no Estoque, lance a entrada que falta e tente de novo. Nada é gravado pela metade: se uma baixa falha, nenhuma é feita.

**Com que valor a peça pronta entra no estoque?**
Com o custo real da peça: materiais baixados, tecido do corte (rateado pelas peças cortadas), mão de obra e custos indiretos. A mão de obra e os indiretos são os da ficha, mas você pode alterá-los ou zerá-los em cada apontamento. Se algum material estiver sem custo, a peça entra sem valor em vez de com um custo errado.

**Por que não existe preço nos materiais?**
O custo de um material vem das **entradas com valor** (nota fiscal ou movimentação), pelo custo médio. Um preço digitado no cadastro seria só um segundo número, sem uso. O preço de venda existe para revenda, acabado e semiacabado.

**A ficha mostra "custo incompleto".**
Algum material nunca teve entrada com valor. Lance uma entrada com o valor unitário para o custo ser calculado.

**Posso editar ou excluir uma movimentação gerada pela produção?**
Não. Elas aparecem em Movimentações com a origem (ordem ou remessa) e sem botões de edição. Para corrigir, use o fluxo da própria Produção ou um ajuste de estoque.

**Mudei a ficha. As ordens abertas mudam?**
Não. Cada ordem fica na versão da ficha em que foi criada. Só as novas usam a versão nova.

**Cancelei uma ordem. Posso reabrir?**
Não. Crie outra. A cota mensal de ordens do plano não é devolvida.

**Atingi o limite do plano.**
O plano limita fichas ativas e ordens por mês. Fale com o administrador da conta para ampliar.

**Por que não vejo a Produção no menu?**
Ou a empresa não contratou o módulo, ou o seu perfil é `contador`, que não usa a Produção.
