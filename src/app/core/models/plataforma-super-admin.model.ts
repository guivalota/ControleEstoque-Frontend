export interface SuperAdmin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarSuperAdmin {
  nome: string;
  email: string;
}

/** Criação/redefinição: a senha provisória só existe nesta resposta. */
export interface SuperAdminSenhaProvisoria {
  superAdmin: SuperAdmin;
  senhaProvisoria: string;
}
