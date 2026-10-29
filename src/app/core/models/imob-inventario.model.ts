export type ImobInventarioStatus = 'rascunho' | 'em_andamento' | 'em_processamento' | 'concluido' | 'cancelado';

export const STATUS_INVENTARIO: ImobInventarioStatus[] = ['rascunho', 'em_andamento', 'em_processamento', 'concluido', 'cancelado'];

export const ROTULO_STATUS_INVENTARIO: Record<ImobInventarioStatus, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  em_processamento: 'Em processamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado'
};

export const CLASSE_STATUS_INVENTARIO: Record<ImobInventarioStatus, string> = {
  rascunho: 'bg-secondary-subtle text-secondary',
  em_andamento: 'bg-primary-subtle text-primary',
  em_processamento: 'bg-warning-subtle text-warning-emphasis',
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
  /** Ciclo de reavaliação (US-19-10): exige data-base e congela parâmetros/escalas/estados ao iniciar. */
  reavaliacao: boolean;
  dataBase?: string | null;
}

export interface ImobInventario extends ImobInventarioResumo, ImobInventarioEncerramento {
  descricao?: string | null;
  atualizadoEm: string;
  locais: { localId: number; localNome: string }[];
  equipe: { usuarioId: string; nome?: string | null }[];
  parametrosId?: number | null;
  escalaVpId?: number | null;
  escalaVfId?: number | null;
}

export interface SalvarImobInventario {
  nome: string;
  descricao?: string;
  localIds: number[];
  usuarioIds?: string[];
  reavaliacao?: boolean;
  dataBase?: string;
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
