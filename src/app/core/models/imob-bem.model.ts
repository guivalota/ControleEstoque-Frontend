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
  dataAquisicao?: string | null;
  valorAquisicao?: number | null;
  valorResidual?: number | null;
  vidaUtilMeses: number;
  /** `false` = falta data ou valor de aquisição (fora da depreciação até completar). */
  dadosCompletos: boolean;
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
  dataAquisicao?: string | null; valorAquisicao?: number | null;
  valorResidual?: number; vidaUtilMeses?: number;
  fornecedorNome?: string; numeroDocumentoAquisicao?: string; numeroSerie?: string; observacao?: string;
}

export interface ImobBemFiltro {
  busca?: string; localId?: number; incluirSublocais?: boolean; categoriaId?: number;
  responsavelId?: number; status?: ImobBemStatus; dadosCompletos?: boolean; page?: number; pageSize?: number;
}

export interface ImobBemHistorico {
  id: number;
  campo: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  valorAnteriorDescricao?: string | null;
  valorNovoDescricao?: string | null;
  usuarioId: string;
  usuarioNome?: string | null;
  /** OS que causou a mudança (nulo para edição direta, criação, exclusão e ajustes de inventário). */
  osId?: number | null;
  osNumero?: number | null;
  criadoEm: string;
}
