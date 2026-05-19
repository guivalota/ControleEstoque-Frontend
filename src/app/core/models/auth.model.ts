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
}

export interface JwtPayload {
  sub: string;
  email: string;
  nome: string;
  role: string;
  exp: number;
}
