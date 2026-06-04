export interface ProdutoEncontrado {
  id: number;
  sku: string;
  nome: string;
}

export interface AnaliseNfeItem {
  itemIndex: number;
  codigoProdutoNF: string;
  descricaoNF: string;
  quantidade: number;
  valorUnitario: number;
  produtoEncontrado: ProdutoEncontrado | null;
}

export interface AnaliseNfeResponse {
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  valorTotal: number;
  jaImportada: boolean;
  notaFiscalIdExistente: number | null;
  itens: AnaliseNfeItem[];
}

export interface ResolucaoItem {
  itemIndex: number;
  acao: 'mapear' | 'criar';
  produtoId?: number;
  categoriaId?: number;
  nome?: string;
  sku?: string;
  preco?: number;
  fazParteEstoque?: boolean;
}

export interface ImportarNfeResponse {
  notaFiscalId: number;
  numero: string;
  serie: string;
  fornecedorId: number;
  fornecedorNome: string;
  totalItens: number;
  produtosNovos: number;
  avisos: string[];
}
