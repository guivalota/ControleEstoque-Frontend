export type ClasseAbc = 'A' | 'B' | 'C';

export interface GiroEstoqueFiltro {
  dataInicio?: string;
  dataFim?: string;
  categoriaId?: number;
  ordenacao?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GiroEstoqueResponse {
  produtoId: number;
  sku: string;
  nome: string;
  categoria: string;
  saldoAtual: number;
  totalSaidas: number;
  giroEstoque: number | null;
}

export interface CurvaAbcFiltro {
  dataInicio?: string;
  dataFim?: string;
  categoriaId?: number;
  classe?: ClasseAbc;
  page?: number;
  pageSize?: number;
}

export interface CurvaAbcResponse {
  produtoId: number;
  sku: string;
  nome: string;
  categoria: string;
  valorMovimentado: number;
  percentualTotal: number;
  percentualAcumulado: number;
  classe: ClasseAbc;
}

export interface ConferenciaResult {
  produtoId: number;
  sku: string;
  nome: string;
  categoria: string;
  saldoAtual: number;
  estoqueMinimo: number;
  pontoReposicao: number;
  totalEntradas: number;
  totalSaidas: number;
  precoMedio: number;
  valorTotalEstoque: number;
  valorTotalMovimentado: number;
  ultimaMovimentacao: string | null;
  primeiraMovimentacao: string | null;
}
