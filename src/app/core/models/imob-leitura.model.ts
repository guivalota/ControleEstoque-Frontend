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
  localLidoId: number;
  localLidoNome: string;
  usuarioId: string;
  usuarioNome?: string | null;
  lidoEm: string;
  origem: 'web' | 'csv' | 'app';
  observacao?: string | null;
  criadoEm: string;
  anulada: boolean;
}

export interface ImobLeituraRegistrada extends ImobLeitura {
  reaproveitada: boolean;
  info: ImobLeituraInfo;
}

export interface RegistrarImobLeitura {
  plaqueta: string;
  localId: number;
  lidoEm?: string;
  clientId?: string;
  observacao?: string;
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
