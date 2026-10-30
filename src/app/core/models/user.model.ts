export type UserRole = 'admin' | 'contador' | 'operador' | 'leitura';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  criadoEm?: string;
  /** Tipo da conta no diretório do super admin (superadmin, plataforma, cliente...). */
  tipo?: string;
}

export interface CreateUserRequest {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  nome?: string | null;
  email?: string | null;
  senha?: string | null;
  role?: UserRole | null;
  ativo?: boolean | null;
}

export interface UpdateMyProfileRequest {
  nome?: string | null;
  email?: string | null;
  senha?: string | null;
}
