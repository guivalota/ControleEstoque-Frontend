export interface Produto {
  id: number;
  sku: string;
  nome: string;
  descricao?: string;
  categoriaId: number;
  categoriaNome?: string;
  precoUnitario: number;
  estoqueMinimo?: number;
  pontoReposicao?: number;
  ativo: boolean;
  criadoEm?: string;
}

export interface CreateProdutoRequest {
  sku: string;
  nome: string;
  descricao?: string | null;
  categoriaId: number;
  precoUnitario: number;
  estoqueMinimo?: number;
  pontoReposicao?: number;
}

export interface UpdateProdutoRequest {
  sku?: string | null;
  nome?: string | null;
  descricao?: string | null;
  categoriaId?: number | null;
  precoUnitario?: number | null;
  ativo?: boolean | null;
  estoqueMinimo?: number | null;
  pontoReposicao?: number | null;
}
