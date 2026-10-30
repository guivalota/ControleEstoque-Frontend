export interface ImobDepartamento {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobDepartamento { codigo: string; nome: string; }
export interface AtualizarImobDepartamento extends CriarImobDepartamento { ativo: boolean; }

export interface ImobDepartamentoFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }
