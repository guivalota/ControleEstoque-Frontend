export type ImobOsTipo = 'transferencia' | 'manutencao' | 'sinistro' | 'venda' | 'baixa';
export type ImobOsStatus = 'pendente' | 'aprovada' | 'concluida' | 'rejeitada' | 'cancelada';
export type ImobOsMotivoBaixa = 'obsolescencia' | 'descarte' | 'doacao' | 'inservivel' | 'outro';

export const TIPOS_OS: ImobOsTipo[] = ['transferencia', 'manutencao', 'sinistro', 'venda', 'baixa'];
export const STATUS_OS: ImobOsStatus[] = ['pendente', 'aprovada', 'concluida', 'rejeitada', 'cancelada'];

export const ROTULO_TIPO_OS: Record<ImobOsTipo, string> = {
  transferencia: 'Transferência',
  manutencao: 'Manutenção',
  sinistro: 'Sinistro',
  venda: 'Venda',
  baixa: 'Baixa'
};

export const ROTULO_STATUS_OS: Record<ImobOsStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Em andamento',
  concluida: 'Concluída',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada'
};

export const CLASSE_STATUS_OS: Record<ImobOsStatus, string> = {
  pendente: 'bg-warning-subtle text-warning-emphasis',
  aprovada: 'bg-primary-subtle text-primary',
  concluida: 'bg-success-subtle text-success',
  rejeitada: 'bg-danger-subtle text-danger',
  cancelada: 'bg-secondary-subtle text-secondary'
};

export const ROTULO_MOTIVO_BAIXA: Record<ImobOsMotivoBaixa, string> = {
  obsolescencia: 'Obsolescência',
  descarte: 'Descarte',
  doacao: 'Doação',
  inservivel: 'Inservível',
  outro: 'Outro'
};

export const MOTIVOS_BAIXA: ImobOsMotivoBaixa[] = ['obsolescencia', 'descarte', 'doacao', 'inservivel', 'outro'];

export const ROTULO_EVENTO_OS: Record<string, string> = {
  criada: 'OS aberta',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída'
};

/** Tipos que o bem em `ativo` aceita; sinistro também `em_manutencao`; baixa também `extraviado`. */
export const STATUS_ELEGIVEIS_OS: Record<ImobOsTipo, string[]> = {
  transferencia: ['ativo'],
  manutencao: ['ativo'],
  sinistro: ['ativo', 'em_manutencao'],
  venda: ['ativo'],
  baixa: ['ativo', 'em_manutencao', 'extraviado']
};

/** Número de exibição: OS-000005. */
export function formatarNumeroOs(numero: number): string {
  return `OS-${String(numero).padStart(6, '0')}`;
}

export interface ImobOsResumo {
  id: number;
  numero: number;
  tipo: ImobOsTipo;
  status: ImobOsStatus;
  solicitanteId: string;
  solicitanteNome?: string | null;
  totalItens: number;
  criadoEm: string;
  decididoEm?: string | null;
}

export interface ImobOsItem {
  id: number;
  bemId: number;
  plaqueta: string;
  descricao: string;
  statusOrigem: string;
  localOrigemId: number;
  localOrigemNome?: string | null;
  responsavelOrigemId?: number | null;
  responsavelOrigemNome?: string | null;
  localDestinoId?: number | null;
  localDestinoNome?: string | null;
  responsavelDestinoId?: number | null;
  responsavelDestinoNome?: string | null;
}

export interface ImobOsEvento {
  id: number;
  evento: string;
  usuarioId: string;
  usuarioNome?: string | null;
  comentario?: string | null;
  criadoEm: string;
}

export interface ImobOs extends ImobOsResumo {
  justificativa: string;
  valorVenda?: number | null;
  compradorNome?: string | null;
  dataVenda?: string | null;
  numeroDocumento?: string | null;
  motivoBaixa?: ImobOsMotivoBaixa | null;
  fornecedorServicoNome?: string | null;
  previsaoConclusao?: string | null;
  custoEstimado?: number | null;
  custoReal?: number | null;
  decididoPorId?: string | null;
  decididoPorNome?: string | null;
  motivoDecisao?: string | null;
  concluidoPorId?: string | null;
  concluidoPorNome?: string | null;
  concluidoEm?: string | null;
  atualizadoEm: string;
  itens: ImobOsItem[];
  eventos: ImobOsEvento[];
}

export interface ImobOsDados {
  valorVenda?: number | null;
  compradorNome?: string;
  dataVenda?: string | null;
  numeroDocumento?: string;
  motivoBaixa?: ImobOsMotivoBaixa;
  fornecedorServicoNome?: string;
  previsaoConclusao?: string | null;
  custoEstimado?: number | null;
}

export interface CriarImobOs {
  tipo: ImobOsTipo;
  justificativa: string;
  dados?: ImobOsDados;
  itens: { bemId: number; localDestinoId?: number | null; responsavelDestinoId?: number | null }[];
}

export interface ImobOsFiltro {
  busca?: string;
  tipo?: ImobOsTipo;
  status?: ImobOsStatus;
  bemId?: number;
  solicitanteId?: string;
  de?: string;
  ate?: string;
  page?: number;
  pageSize?: number;
}
