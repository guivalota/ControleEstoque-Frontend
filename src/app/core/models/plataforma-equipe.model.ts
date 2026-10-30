export type PerfilEquipe = 'admin' | 'contador' | 'operador' | 'leitura';

/** Membro da equipe de uma empresa (`/v1/plataforma/empresas/{id}/equipe`). */
export interface EquipeMembro {
  usuarioId: string;
  nome: string;
  email: string;
  perfil: PerfilEquipe | string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarEquipeMembro {
  nome: string;
  email: string;
  perfil: PerfilEquipe;
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
