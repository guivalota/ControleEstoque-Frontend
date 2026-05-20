export interface Fornecedor {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  municipio?: string;
  uf?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CreateFornecedorRequest {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface UpdateFornecedorRequest {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  ativo?: boolean | null;
}
