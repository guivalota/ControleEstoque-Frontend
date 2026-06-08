export interface ConferenciaResult {
  produtoId: number;
  sku: string;
  nome: string;
  categoria: string;
  saldoAtual: number;
  pontoReposicao: number;
  totalEntradas: number;
  totalSaidas: number;
  precoMedio: number;
  valorTotalEstoque: number;
  valorTotalMovimentado: number;
  ultimaMovimentacao: string | null;
  primeiraMovimentacao: string | null;
}
