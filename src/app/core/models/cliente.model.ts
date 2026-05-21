export interface Cliente {
  id: number;
  cpfCnpj: string;
  nome: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  municipio?: string;
  uf?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CreateClienteRequest {
  cpfCnpj: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface UpdateClienteRequest {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  ativo?: boolean | null;
}
