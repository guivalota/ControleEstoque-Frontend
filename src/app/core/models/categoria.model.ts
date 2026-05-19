export interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm?: string;
}

export interface CreateCategoriaRequest {
  nome: string;
  descricao?: string | null;
}

export interface UpdateCategoriaRequest {
  nome?: string | null;
  descricao?: string | null;
  ativo?: boolean | null;
}
