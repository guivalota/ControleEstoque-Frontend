import { UserRole } from './user.model';

/** Usuário vinculado à empresa ativa (`GET v1/empresa-ativa/usuarios`). Sem tipo de conta e sem senha. */
export interface UsuarioEmpresa {
  id: string;
  nome: string;
  email: string;
  /** Perfil global da conta. */
  perfil: UserRole;
  /** Perfil efetivo na empresa ativa. */
  perfilEfetivo: UserRole;
  ativo: boolean;
}

export interface FiltroUsuariosEmpresa {
  /** Nome ou e-mail. */
  busca?: string;
  ativo?: boolean;
  page?: number;
  /** Máximo 100 (padrão do servidor: 50). */
  pageSize?: number;
}
