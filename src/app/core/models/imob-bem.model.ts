export type ImobBemStatus = 'ativo' | 'em_manutencao' | 'baixado' | 'vendido' | 'extraviado';

export const ROTULO_STATUS_BEM: Record<ImobBemStatus, string> = {
  ativo: 'Ativo',
  em_manutencao: 'Em manutenção',
  baixado: 'Baixado',
  vendido: 'Vendido',
  extraviado: 'Extraviado'
};

export const CLASSE_STATUS_BEM: Record<ImobBemStatus, string> = {
  ativo: 'bg-success-subtle text-success',
  em_manutencao: 'bg-warning-subtle text-warning-emphasis',
  baixado: 'bg-secondary-subtle text-secondary',
  vendido: 'bg-info-subtle text-info-emphasis',
  extraviado: 'bg-danger-subtle text-danger'
};

export const STATUS_BEM: ImobBemStatus[] = ['ativo', 'em_manutencao', 'baixado', 'vendido', 'extraviado'];

/** Bens baixados ou vendidos não podem mais ser editados. */
export function bemEditavel(status: ImobBemStatus): boolean {
  return status !== 'baixado' && status !== 'vendido';
}

export interface ImobBem {
  id: number;
  plaqueta: string;
  descricao: string;
  categoriaId: number; categoriaNome: string;
  localId: number; localNome: string;
  responsavelId?: number | null; responsavelNome?: string | null;
  dataAquisicao: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilMeses: number;
  status: ImobBemStatus;
  fornecedorNome?: string | null;
  numeroDocumentoAquisicao?: string | null;
  numeroSerie?: string | null;
  observacao?: string | null;
  criadoEm: string; atualizadoEm: string;
}

export interface SalvarImobBem {
  plaqueta: string; descricao: string;
  categoriaId: number; localId: number; responsavelId?: number | null;
  dataAquisicao: string; valorAquisicao: number;
  valorResidual?: number; vidaUtilMeses?: number;
  fornecedorNome?: string; numeroDocumentoAquisicao?: string; numeroSerie?: string; observacao?: string;
}

export interface ImobBemFiltro {
  busca?: string; localId?: number; incluirSublocais?: boolean; categoriaId?: number;
  responsavelId?: number; status?: ImobBemStatus; page?: number; pageSize?: number;
}
