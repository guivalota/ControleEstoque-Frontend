export type ImobInventarioStatus = 'rascunho' | 'em_andamento' | 'concluido' | 'cancelado';

export const STATUS_INVENTARIO: ImobInventarioStatus[] = ['rascunho', 'em_andamento', 'concluido', 'cancelado'];

export const ROTULO_STATUS_INVENTARIO: Record<ImobInventarioStatus, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

export const CLASSE_STATUS_INVENTARIO: Record<ImobInventarioStatus, string> = {
  rascunho: 'bg-secondary-subtle text-secondary',
  em_andamento: 'bg-primary-subtle text-primary',
  concluido: 'bg-success-subtle text-success',
  cancelado: 'bg-danger-subtle text-danger'
};

export interface ImobInventarioResumo {
  id: number;
  nome: string;
  status: ImobInventarioStatus;
  dataInicio?: string | null;
  dataFim?: string | null;
  criadoPorId: string;
  criadoPorNome?: string | null;
  criadoEm: string;
  totalLocais: number;
  /** 0 enquanto for rascunho: o esperado só é congelado ao iniciar. */
  totalEsperados: number;
}

export interface ImobInventario extends ImobInventarioResumo, ImobInventarioEncerramento {
  descricao?: string | null;
  atualizadoEm: string;
  locais: { localId: number; localNome: string }[];
  equipe: { usuarioId: string; nome?: string | null }[];
}

export interface SalvarImobInventario {
  nome: string;
  descricao?: string;
  localIds: number[];
  usuarioIds?: string[];
}

export interface ImobInventarioFiltro {
  busca?: string;
  status?: ImobInventarioStatus;
  page?: number;
  pageSize?: number;
}

/** Edição: rascunho (tudo) e em andamento (escopo congelado). */
export function inventarioEditavel(status: ImobInventarioStatus): boolean {
  return status === 'rascunho' || status === 'em_andamento';
}

/** Cancelável de rascunho ou em andamento. */
export const inventarioCancelavel = inventarioEditavel;

/** Exclusão (admin): só rascunho ou cancelado. */
export function inventarioExcluivel(status: ImobInventarioStatus): boolean {
  return status === 'rascunho' || status === 'cancelado';
}

export interface ImobInventarioEncerramento {
  encerradoPorId?: string | null;
  encerradoPorNome?: string | null;
  /** Divergências sem decisão no momento do encerramento (nulo se não encerrado). */
  pendenciasAoEncerrar?: number | null;
}
