export type TipoNotaFiscal = 'entrada' | 'saida';

export interface NotaFiscal {
  id: number;
  numero: string;
  serie: string;
  tipo: TipoNotaFiscal;
  fornecedorNome: string;
  fornecedorCnpj: string;
  dataEmissao: string;
  valorTotal: number;
  status: string;
  observacao?: string;
  usuarioId: number;
  criadoEm: string;
}

export interface ItemNotaFiscalRequest {
  produtoId: number;
  quantidade: number;
  valorUnitario: number;
  observacao?: string | null;
}

export interface CreateNotaFiscalRequest {
  numero: string;
  serie: string;
  tipo: TipoNotaFiscal;
  fornecedorNome: string;
  fornecedorCnpj: string;
  dataEmissao: string;
  valorTotal: number;
  observacao?: string | null;
  fornecedorId?: number | null;
  itens: ItemNotaFiscalRequest[];
}

