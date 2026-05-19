export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste';

export interface Movimentacao {
  id: number;
  produtoId: number;
  produtoNome?: string;
  produtoSku?: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  valorUnitario?: number;
  valorTotal?: number;
  notaFiscalId?: number;
  observacao?: string;
  criadoEm: string;
  usuarioId?: number;
}

export interface CreateMovimentacaoRequest {
  produtoId: number;
  tipo: TipoMovimentacao;
  quantidade: number;
  valorUnitario: number;
  observacao?: string | null;
}

export interface SaldoEstoque {
  produtoId: number;
  saldo: number;
}
