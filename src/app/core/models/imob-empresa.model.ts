export interface ImobEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  ativo: boolean;
  criadoEm: string;
  /** Perfil efetivo do usuário nesta empresa (menor entre a role global e o vínculo). */
  perfil?: ImobPerfil;
}

export type ImobPerfil = 'admin' | 'operador' | 'leitura';

export const PERFIS_IMOB: ImobPerfil[] = ['admin', 'operador', 'leitura'];

export const ROTULO_PERFIL: Record<ImobPerfil, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  leitura: 'Somente leitura'
};

export interface ImobUsuarioEmpresa {
  usuarioId: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
  /** Role global do usuário (teto do perfil). */
  role?: ImobPerfil;
  /** Perfil gravado no vínculo. */
  perfil?: ImobPerfil;
  /** O que vale de fato: o menor entre `role` e `perfil`. */
  perfilEfetivo?: ImobPerfil;
}

export interface CriarImobEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
}

export interface AtualizarImobEmpresa extends CriarImobEmpresa {
  ativo: boolean;
}
