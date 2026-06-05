export interface Impressao {
  id: number;
  tipoDocumento: string;
  documentoId: number;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: string;
}

export interface ImpressaoFiltros {
  tipoDocumento?: string;
  documentoId?: number;
  usuarioId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}
