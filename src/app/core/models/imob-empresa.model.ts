export interface ImobEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  ativo: boolean;
  criadoEm: string;
}

export interface ImobUsuarioEmpresa {
  usuarioId: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
}

export interface AtualizarImobEmpresa extends CriarImobEmpresa {
  ativo: boolean;
}
