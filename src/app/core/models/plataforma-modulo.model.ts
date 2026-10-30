/** Módulo do catálogo com o estado na empresa (`GET empresas/{id}/modulos`). */
export interface EmpresaModulo {
  codigo: string;
  nome?: string | null;
  descricao?: string | null;
  dependeDe?: string[] | null;
  ativo: boolean;
  ativadoEm?: string | null;
  desativadoEm?: string | null;
}

export interface DefinirEmpresaModulo {
  ativo: boolean;
  /** Até 280 caracteres. */
  motivo?: string | null;
}

/** Evento append-only de módulos (`acao` é texto livre do servidor). */
export interface EmpresaModuloEvento {
  id: number;
  moduloCodigo?: string | null;
  acao?: string | null;
  detalhe?: string | null;
  atorUsuarioId?: string | null;
  atorNome?: string | null;
  alvoUsuarioId?: string | null;
  alvoNome?: string | null;
  criadoEm: string;
}
