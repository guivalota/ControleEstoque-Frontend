export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste' | 'ajuste_saida';
export type MotivoAjuste = 'inventario' | 'quebra' | 'furto' | 'vencimento' | 'erro_lancamento' | 'devolucao' | 'outro';

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
  dataMovimentacao?: string;
  observacao?: string;
  motivoAjuste?: MotivoAjuste;
  criadoEm: string;
  usuarioId?: string;
}

export interface CreateMovimentacaoRequest {
  produtoId: number;
  tipo: TipoMovimentacao;
  quantidade: number;
  valorUnitario: number;
  dataMovimentacao?: string | null;
  observacao?: string | null;
  motivoAjuste?: MotivoAjuste | null;
}

export interface UpdateMovimentacaoRequest {
  tipo: TipoMovimentacao;
  quantidade: number;
  valorUnitario: number;
  dataMovimentacao?: string | null;
  observacao?: string | null;
  motivoAjuste?: MotivoAjuste | null;
}

export interface SaldoEstoque {
  produtoId: number;
  saldo: number;
}
