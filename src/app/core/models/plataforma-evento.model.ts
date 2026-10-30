/** Trilha da plataforma (`GET v1/plataforma/eventos`). */
export interface PlataformaEvento {
  id: number;
  acao: string;
  detalhe?: string | null;
  atorUsuarioId?: string | null;
  atorNome: string;
  empresaId?: number | null;
  empresaNome: string;
  alvoUsuarioId?: string | null;
  alvoNome: string;
  criadoEm: string;
}

export interface PlataformaEventoFiltros {
  empresaId?: number;
  atorId?: string;
  acao?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

/** Logs técnicos do sistema (`GET v1/plataforma/logs`, Serilog; mascarados pelo servidor). Resposta paginada padrão (`PagedResult`). */
export interface LogSistema {
  id: number | string;
  timestamp: string;
  nivel: string;
  mensagem: string;
  origem?: string | null;
}

export interface LogSistemaFiltros {
  dataInicio?: string;
  dataFim?: string;
  /** Verbose | Debug | Information | Warning | Error | Fatal */
  nivel?: string;
  page?: number;
  pageSize?: number;
}
