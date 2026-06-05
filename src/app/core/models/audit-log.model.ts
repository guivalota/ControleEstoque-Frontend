export interface AuditLog {
  id: number;
  usuarioId: string;
  usuarioNome: string;
  endpoint: string;
  method: string;
  recursoId: string | null;
  ip: string;
  criadoEm: string;
}

export interface AuditLogFiltros {
  usuarioId?: string;
  method?: string;
  endpoint?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}
