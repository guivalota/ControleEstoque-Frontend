export type UserRole = 'admin' | 'operador' | 'leitura';

export interface User {
  id: number;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  criadoEm?: string;
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
