export interface AuditLog {
  id: number;
  usuarioId: string;
  usuarioNome: string;
  endpoint: string;
  method: string;
  recursoId: string | null;
  ip: string;
  criadoEm: string;
  /** Empresa do Imobilizado validada pelo servidor; nulo para Estoque, plataforma e acessos negados. */
  empresaId?: number | null;
  empresaNome?: string | null;
}

export interface AuditLogFiltros {
  usuarioId?: string;
  method?: string;
  endpoint?: string;
  empresaId?: number;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}
