export interface ImobCategoria {
  id: number;
  nome: string;
  vidaUtilMeses: number;
  valorResidualPercentual: number;
  metodoDepreciacao: 'linear';
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobCategoria {
  nome: string;
  vidaUtilMeses: number;
  valorResidualPercentual: number;
  metodoDepreciacao?: 'linear';
}
export interface AtualizarImobCategoria extends CriarImobCategoria { ativo: boolean; }

export interface ImobCategoriaFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }
