export interface ImobCategoria {
  id: number;
  codigo?: string | null;
  nome: string;
  vidaUtilMeses: number;
  /** Somente leitura: 12 ÷ vidaUtilMeses × 100 (calculado pelo servidor). */
  depreciacaoAnualPercentual?: number | null;
  /** Referência (D-036, PEND-090): não preenche o residual do bem. */
  valorResidualPercentual: number;
  metodoDepreciacao: 'linear';
  ativo: boolean;
  criadoEm: string;
  grupoId?: number | null;
  grupoNome?: string | null;
}

export interface CriarImobCategoria {
  /** Opcional (<= 50, único por empresa). Na edição, omitir limpa o código. */
  codigo?: string;
  nome: string;
  vidaUtilMeses: number;
  valorResidualPercentual: number;
  metodoDepreciacao?: 'linear';
  /** Grupo (opcional); o bem herda o grupo pela categoria. Na edição, omitir limpa o grupo. */
  grupoId?: number | null;
}
export interface AtualizarImobCategoria extends CriarImobCategoria { ativo: boolean; }

export interface ImobCategoriaFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }

export interface ImobCategoriasPadraoResultado {
  criadas: number;
  jaExistentes: number;
  categorias: ImobCategoria[];
}
