export interface LoginRequest {
  email: string;
  senha: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  /** Senha provisória: o usuário precisa definir uma nova antes de usar o sistema. */
  precisaTrocarSenha?: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  novaSenha: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  nome: string;
  role: string;
  exp: number;
}
