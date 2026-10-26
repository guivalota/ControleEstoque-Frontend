export type SituacaoConciliacao = 'encontrado' | 'local_divergente' | 'nao_encontrado' | 'sobra' | 'duplicado';

export const SITUACOES_CONCILIACAO: SituacaoConciliacao[] =
  ['encontrado', 'local_divergente', 'nao_encontrado', 'sobra', 'duplicado'];

export const ROTULO_SITUACAO: Record<SituacaoConciliacao, string> = {
  encontrado: 'Encontrado',
  local_divergente: 'Local divergente',
  nao_encontrado: 'Não encontrado',
  sobra: 'Sobra',
  duplicado: 'Duplicado'
};

export const CLASSE_SITUACAO: Record<SituacaoConciliacao, string> = {
  encontrado: 'bg-success-subtle text-success',
  local_divergente: 'bg-warning-subtle text-warning-emphasis',
  nao_encontrado: 'bg-danger-subtle text-danger',
  sobra: 'bg-info-subtle text-info-emphasis',
  duplicado: 'bg-secondary-subtle text-secondary'
};

export type AcaoResolucao = 'ajustar_local' | 'manter';

export interface ConciliacaoResolucao {
  acao: AcaoResolucao;
  localDestinoId?: number | null;
  localDestinoNome?: string | null;
  observacao?: string | null;
  resolvidoPorId?: string | null;
  resolvidoPorNome?: string | null;
  resolvidoEm: string;
}

export interface ConciliacaoItem {
  itemId?: number | null;
  bemId?: number | null;
  plaqueta: string;
  descricao?: string | null;
  situacao: SituacaoConciliacao;
  localEsperadoId?: number | null;
  localEsperadoNome?: string | null;
  localLidoId?: number | null;
  localLidoNome?: string | null;
  locaisLidos: { localId: number; localNome: string }[];
  qtdLeituras: number;
  leiturasRepetidas: boolean;
  primeiraLeituraEm?: string | null;
  ultimaLeituraEm?: string | null;
  resolvida: boolean;
  resolucaoDesatualizada: boolean;
  resolucao?: ConciliacaoResolucao | null;
}

export interface ConciliacaoResumo {
  inventarioId: number;
  statusInventario: string;
  esperados: number;
  esperadosLidos: number;
  percentualLido: number;
  encontrados: number;
  localDivergente: number;
  naoEncontrados: number;
  sobras: number;
  duplicados: number;
  plaquetasComLeiturasRepetidas: number;
  leiturasAtivas: number;
  leiturasAnuladas: number;
  divergenciasPendentes: number;
  divergenciasResolvidas: number;
  resolucoesDesatualizadas: number;
}

export interface ConciliacaoFiltro {
  situacao?: SituacaoConciliacao;
  apenasDivergencias?: boolean;
  resolucao?: 'pendentes' | 'resolvidas';
  localId?: number;
  busca?: string;
  page?: number;
  pageSize?: number;
}

export interface ResolverConciliacao {
  plaqueta: string;
  acao: AcaoResolucao;
  localDestinoId?: number | null;
  observacao?: string;
}

export interface PainelLocal {
  localId: number;
  localNome: string;
  localPaiId?: number | null;
  esperados: number;
  lidos: number;
  percentualLido: number;
  encontrados: number;
  localDivergente: number;
  naoEncontrados: number;
  duplicados: number;
  sobrasLidas: number;
  divergenciasPendentes: number;
}

export interface PainelEquipe {
  usuarioId: string;
  nome?: string | null;
  naEquipe: boolean;
  leituras: number;
  plaquetasDistintas: number;
  primeiraLeituraEm?: string | null;
  ultimaLeituraEm?: string | null;
}

export interface PainelInventario {
  resumo: ConciliacaoResumo;
  locais: PainelLocal[];
  equipe: PainelEquipe[];
}
