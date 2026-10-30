/** Estado de conservação (notas de 0 a 10 usadas na reavaliação). */
export interface ImobEstadoConservacao {
  id: number;
  nome: string;
  notaEc: number;
  notaVidaRemanescente: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarImobEstadoConservacao { nome: string; notaEc: number; notaVidaRemanescente: number; }
export interface AtualizarImobEstadoConservacao extends CriarImobEstadoConservacao { ativo: boolean; }
export interface ImobEstadoConservacaoFiltro { busca?: string; ativo?: boolean; page?: number; pageSize?: number; }

export interface ImobEstadosPadraoResultado {
  criados: number;
  estados: ImobEstadoConservacao[];
}

export const ROTULO_CAMPO_HISTORICO_ESTADO: Record<string, string> = {
  criacao: 'Criação',
  nome: 'Nome',
  nota_ec: 'Nota EC',
  nota_vida_remanescente: 'Nota de vida remanescente',
  ativo: 'Situação',
  exclusao: 'Exclusão'
};

export interface ImobEstadoConservacaoHistorico {
  id: number;
  /** criacao | nome | nota_ec | nota_vida_remanescente | ativo | exclusao */
  campo: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  criadoEm: string;
}

// ---- pesos ----

export const ROTULO_CAMPO_PESO: Record<string, string> = {
  peso_ec: 'Peso EC',
  peso_vf: 'Peso VF',
  peso_vp: 'Peso VP',
  divisor: 'Divisor'
};

export interface ImobParametrosAlteracao {
  /** peso_ec | peso_vf | peso_vp | divisor */
  campo: string;
  anterior: number | string | null;
  novo: number | string | null;
}

export interface ImobParametrosVersao {
  id: number;
  versao: number;
  pesoEc: number;
  pesoVf: number;
  pesoVp: number;
  divisor: number;
  vigente: boolean;
  motivo?: string | null;
  criadoPor?: string | null;
  criadoPorNome?: string | null;
  criadoEm: string;
  /** Diferença para a versão anterior; vazio na versão 1. */
  alteracoes: ImobParametrosAlteracao[];
}

export interface CriarImobParametrosVersao {
  pesoEc: number;
  pesoVf: number;
  pesoVp: number;
  divisor: number;
  motivo?: string;
}

// ---- escalas ----

export type TipoEscala = 'vp' | 'vf';

export const ROTULO_ESCALA: Record<TipoEscala, { titulo: string; entrada: string }> = {
  vp: { titulo: 'Escala VP', entrada: 'idade (anos)' },
  vf: { titulo: 'Escala VF', entrada: 'nota de vida remanescente' }
};

/** Faixa semiaberta [de, ate); `ate = null` = sem limite superior. */
export interface ImobEscalaFaixa {
  ordem?: number;
  de: number;
  ate: number | null;
  nota: number;
}

export interface ImobEscala {
  id: number;
  tipo: TipoEscala;
  versao: number;
  vigente: boolean;
  motivo?: string | null;
  criadoPor?: string | null;
  criadoPorNome?: string | null;
  criadoEm: string;
  faixas: ImobEscalaFaixa[];
}

export interface ImobEscalasVigentes { vp: ImobEscala; vf: ImobEscala; }

export interface CriarImobEscala {
  motivo?: string;
  faixas: { de: number; ate: number | null; nota: number }[];
}

export interface ImobEscalaNota {
  tipo: TipoEscala;
  escalaId: number;
  versao: number;
  valor: number;
  nota: number;
}
