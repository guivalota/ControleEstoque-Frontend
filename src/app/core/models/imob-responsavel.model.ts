export interface ImobResponsavel {
  id: number;
  nome: string;
  matricula?: string | null;
  email?: string | null;
  setor?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarImobResponsavel {
  nome: string;
  matricula?: string;
  email?: string;
  setor?: string;
}
export interface AtualizarImobResponsavel extends CriarImobResponsavel { ativo: boolean; }

export interface ImobResponsavelFiltro {
  busca?: string; setor?: string; ativo?: boolean; page?: number; pageSize?: number;
}
