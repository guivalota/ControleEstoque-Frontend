/** Empresa na administração da plataforma (`/v1/plataforma/empresas`). */
export interface PlataformaEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  /** CNPJ numérico ou alfanumérico, como o servidor devolve. */
  cnpj: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarPlataformaEmpresa {
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
}

export interface AtualizarPlataformaEmpresa extends CriarPlataformaEmpresa {
  ativo: boolean;
}

export interface CriarAdminInicial {
  nome: string;
  email: string;
}

export interface PlataformaMembro {
  usuarioId: string;
  nome?: string | null;
  email?: string | null;
  perfil?: string | null;
  ativo: boolean;
  criadoEm: string;
}

/** Resposta de `POST empresas/{id}/admin-inicial`. A senha provisória só existe nesta resposta. */
export interface AdminInicialResponse {
  usuario: PlataformaMembro;
  senhaProvisoria?: string | null;
}

/** Item do histórico de bloqueios (`GET empresas/{id}/bloqueios`), mais recente primeiro. */
export interface EmpresaBloqueio {
  id: number;
  acao: 'bloqueou' | 'desbloqueou';
  motivo?: string | null;
  atorUsuarioId: string;
  atorNome: string;
  criadoEm: string;
}

/** `POST empresas/onboarding`: empresa + plano + módulos + admin inicial numa transação. */
export interface OnboardingEmpresa {
  razaoSocial: string;
  cnpj: string;
  planoId?: number | null;
  sincronizarModulos?: boolean;
  admin: CriarAdminInicial;
}

/** A senha provisória só existe nesta resposta. */
export interface OnboardingResponse {
  empresaId: number;
  senhaProvisoria: string;
}
