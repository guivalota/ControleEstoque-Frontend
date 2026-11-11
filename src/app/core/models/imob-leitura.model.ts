export type SituacaoPrevista = 'no_local_esperado' | 'em_outro_local' | 'fora_do_esperado' | 'plaqueta_desconhecida';

export const ROTULO_SITUACAO_PREVISTA: Record<SituacaoPrevista, string> = {
  no_local_esperado: 'Esperado aqui',
  em_outro_local: 'Esperado em outro local',
  fora_do_esperado: 'Fora do esperado',
  plaqueta_desconhecida: 'Plaqueta não cadastrada'
};

export const CLASSE_SITUACAO_PREVISTA: Record<SituacaoPrevista, string> = {
  no_local_esperado: 'text-success',
  em_outro_local: 'text-warning-emphasis',
  fora_do_esperado: 'text-warning',
  plaqueta_desconhecida: 'text-danger'
};

export const ICONE_SITUACAO_PREVISTA: Record<SituacaoPrevista, string> = {
  no_local_esperado: 'bi-check-circle-fill',
  em_outro_local: 'bi-exclamation-triangle-fill',
  fora_do_esperado: 'bi-exclamation-triangle-fill',
  plaqueta_desconhecida: 'bi-x-circle-fill'
};

export interface ImobLeituraInfo {
  plaqueta: string;
  plaquetaAnterior?: string | null;
  noEsperado: boolean;
  bemId?: number | null;
  descricao?: string | null;
  localEsperadoId?: number | null;
  localEsperadoNome?: string | null;
  leiturasAtivas: number;
  situacaoPrevista?: SituacaoPrevista | null;
}

export interface ImobLeitura {
  id: number;
  clientId: string;
  plaqueta: string;
  plaquetaAnterior?: string | null;
  localLidoId: number;
  localLidoNome: string;
  usuarioId: string;
  usuarioNome?: string | null;
  lidoEm: string;
  origem: 'web' | 'csv' | 'app';
  observacao?: string | null;
  /** Ponto GPS da leitura (E27); só o app envia. */
  latitude?: number | null;
  longitude?: number | null;
  criadoEm: string;
  anulada: boolean;
}

export interface ImobLeituraRegistrada extends ImobLeitura {
  reaproveitada: boolean;
  info: ImobLeituraInfo;
  /** Resultado da conferência enviada junto (reavaliação). */
  conferencia?: ResultadoConferencia | null;
  conferenciaErro?: string | null;
}

/** Conferência da reavaliação (estado, valor de mercado, departamento encontrados). */
export interface ImobConferenciaDados {
  estadoId?: number | null;
  valorMercado?: number | null;
  departamentoId?: number | null;
}

export type ResultadoConferencia = 'gravada' | 'ignorada' | 'fora_do_esperado' | 'erro';

export const ROTULO_RESULTADO_CONFERENCIA: Record<ResultadoConferencia, string> = {
  gravada: 'Conferência gravada',
  ignorada: 'Ignorada: já existe uma conferência mais recente',
  fora_do_esperado: 'Bem fora do esperado deste ciclo',
  erro: 'Conferência com erro'
};

export interface ImobConferenciaLoteItem extends ImobConferenciaDados {
  bemId?: number;
  plaqueta?: string;
  lidoEm?: string;
}

export interface ResultadoConferenciaLote {
  gravadas: number;
  ignoradas: number;
  foraDoEsperado: number;
  comErro: number;
  itens: { indice: number; bemId?: number | null; plaqueta?: string | null; resultado: ResultadoConferencia; erro?: string | null }[];
}

export type SituacaoConferencia = 'todos' | 'conferidos' | 'nao_encontrados' | 'incompletos';

export const ROTULO_SITUACAO_CONFERENCIA: Record<SituacaoConferencia, string> = {
  todos: 'Todos os bens esperados',
  conferidos: 'Encontrados',
  nao_encontrados: 'Ainda não encontrados',
  incompletos: 'Encontrados sem estado ou sem valor'
};

export interface ImobConferenciaFiltro {
  busca?: string;
  situacao?: SituacaoConferencia;
  page?: number;
  pageSize?: number;
}

export interface ImobConferenciaLinha {
  bemId: number;
  plaqueta: string;
  descricao?: string | null;
  localEsperadoId?: number | null;
  localEsperadoNome?: string | null;
  encontrado: boolean;
  estadoId?: number | null;
  estadoNome?: string | null;
  valorMercado?: number | null;
  departamentoId?: number | null;
  departamentoNome?: string | null;
  conferidoPor?: string | null;
  conferidoPorNome?: string | null;
  conferidoEm?: string | null;
  /** Encontrado, mas sem estado ou sem valor de mercado: o cálculo da reavaliação ficaria pendente. */
  incompleto: boolean;
  /** Fotos de evidência da conferência (E28). */
  qtdFotos: number;
  primeiraFotoId?: number | null;
}

/** Uma alteração gravada na conferência (append-only; E28 / DSG-30 R3). */
export interface ImobConferenciaEvento {
  id: number;
  /** encontrado, estado_id, valor_mercado, departamento_id, local_lido_id, observacao, foto_adicionada, foto_removida. */
  campo: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  /** Nome (da época) quando o campo guarda um id de estado, departamento ou local. */
  valorAnteriorNome?: string | null;
  valorNovoNome?: string | null;
  usuarioId: string;
  usuarioNome?: string | null;
  origem: 'app' | 'web' | 'csv';
  lidoEm?: string | null;
  criadoEm: string;
}

/** A conferência de um bem num ciclo: esperado (congelado) × encontrado e o histórico. */
export interface ImobConferenciaDetalhe {
  inventarioId: number;
  inventarioNome: string;
  inventarioStatus: string;
  dataBase?: string | null;
  bemId: number;
  plaqueta: string;
  descricao?: string | null;
  localEsperadoId?: number | null;
  localEsperadoNome?: string | null;
  /** Nulo em ciclos iniciados antes da migration 0092 ou quando o bem não tinha departamento. */
  departamentoEsperadoId?: number | null;
  departamentoEsperadoNome?: string | null;
  encontrado: boolean;
  localLidoId?: number | null;
  localLidoNome?: string | null;
  estadoId?: number | null;
  estadoNome?: string | null;
  valorMercado?: number | null;
  departamentoId?: number | null;
  departamentoNome?: string | null;
  observacao?: string | null;
  conferidoPor?: string | null;
  conferidoPorNome?: string | null;
  conferidoEm?: string | null;
  incompleto: boolean;
  /** O ciclo está concluído: a conferência e as fotos são só leitura. */
  somenteLeitura: boolean;
  eventos: ImobConferenciaEvento[];
}

export interface ImobConferenciaResumo {
  esperados: number;
  encontrados: number;
  naoEncontrados: number;
  completos: number;
  incompletos: number;
}

export interface ImobConferenciaLista {
  items: ImobConferenciaLinha[];
  page: number;
  pageSize: number;
  total: number;
  resumo: ImobConferenciaResumo;
}

export interface RelatorioImportacaoConferencias {
  somenteValidacao: boolean;
  totalLinhas: number;
  linhasValidas: number;
  linhasComErro: number;
  gravadas: number;
  ignoradas: number;
  foraDoEsperado: number;
  totalErros: number;
  errosTruncados: boolean;
  erros: { linha: number; plaqueta?: string | null; campo: string; mensagem: string }[];
  colunasIgnoradas: string[];
}

export interface RegistrarImobLeitura {
  plaqueta: string;
  localId: number;
  lidoEm?: string;
  clientId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  /** Só em inventário de reavaliação. */
  conferencia?: ImobConferenciaDados;
}

export interface ImobLeituraFiltro {
  plaqueta?: string;
  localId?: number;
  usuarioId?: string;
  incluirAnuladas?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ResultadoLote {
  criadas: number;
  reaproveitadas: number;
  comErro: number;
  itens: { indice: number; clientId?: string | null; status: 'criada' | 'reaproveitada' | 'erro'; erro?: string | null }[];
}

export interface RelatorioImportacaoLeituras {
  somenteValidacao: boolean;
  totalLinhas: number;
  linhasValidas: number;
  linhasComErro: number;
  importadas: number;
  jaExistentes: number;
  totalErros: number;
  errosTruncados: boolean;
  erros: { linha: number; plaqueta?: string | null; campo: string; mensagem: string }[];
  colunasIgnoradas: string[];
}
