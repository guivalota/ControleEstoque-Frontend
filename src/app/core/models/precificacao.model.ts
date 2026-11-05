/** Preço mínimo sugerido de um produto acabado: custo da ficha vigente + margem e despesas de venda definidas. */
export interface Precificacao {
  produtoId: number;
  variacaoId: number | null;
  margemPercentual: number;
  despesasVendaPercentual: number;
  temFicha: boolean;
  /** Custo por peça com o custo médio de hoje; nulo sem ficha ou com material sem custo. */
  custoUnitario: number | null;
  precoMinimoSugerido: number | null;
  /** Preço de venda do cadastro do produto (0 = não informado). */
  precoVenda: number;
  abaixoDoMinimo: boolean;
  margemAtualPercentual: number | null;
  materiaisSemCusto: string[];
  /** Produto com grade: um cálculo por variação (o consumo, e o custo, podem mudar por variação). Com variações, o custo e o mínimo acima valem só para a base comum. */
  variacoes: PrecificacaoVariacao[];
}

export interface PrecificacaoVariacao {
  variacaoId: number;
  sku: string;
  custoUnitario: number | null;
  precoMinimoSugerido: number | null;
  precoVenda: number;
  abaixoDoMinimo: boolean;
  margemAtualPercentual: number | null;
  materiaisSemCusto: string[];
}
