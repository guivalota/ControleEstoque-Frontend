export type PerfilEquipe = 'admin' | 'contador' | 'operador' | 'leitura';

/** Membro da equipe de uma empresa (`/v1/plataforma/empresas/{id}/equipe`). */
export interface EquipeMembro {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: PerfilEquipe | string;
  /** Perfil de acesso da empresa (E25); ausente em servidor antigo e na equipe vista pelo super admin. */
  perfilId?: number | null;
  perfilNome?: string | null;
  /** Módulos que o usuário acessa; nulo/ausente = todos os da empresa. */
  modulos?: string[] | null;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarEquipeMembro {
  nome: string;
  email: string;
  perfil: PerfilEquipe;
  /** Perfil de acesso da empresa; quando informado vale sobre `perfil`. */
  perfilId?: number | null;
}

/** Criação/redefinição: a senha provisória só existe nesta resposta. */
export interface EquipeSenhaProvisoria {
  usuario: EquipeMembro;
  senhaProvisoria: string;
}

export interface EquipeEvento {
  id: number;
  acao: string;
  detalhe?: string | null;
  atorUsuarioId: string;
  atorNome: string;
  alvoUsuarioId: string;
  alvoNome: string;
  criadoEm: string;
}
