export interface Produto {
  id: number;
  sku: string;
  nome: string;
  descricao?: string;
  categoriaId: number;
  categoriaNome?: string;
  precoUnitario: number;
  ativo: boolean;
  criadoEm?: string;
}

export interface CreateProdutoRequest {
  sku: string;
  nome: string;
  descricao?: string | null;
  categoriaId: number;
  precoUnitario: number;
}

export interface UpdateProdutoRequest {
  sku?: string | null;
  nome?: string | null;
  descricao?: string | null;
  categoriaId?: number | null;
  precoUnitario?: number | null;
  ativo?: boolean | null;
}
