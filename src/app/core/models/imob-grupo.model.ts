export interface ImobGrupo {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobGrupo { codigo: string; nome: string; }
export interface AtualizarImobGrupo extends CriarImobGrupo { ativo: boolean; }

export interface ImobGrupoFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }
