/** Caixa de aprovações do Core (US-22-07): serve a qualquer módulo que registre um tipo de aprovação. */

export type StatusAprovacao = 'pendente' | 'aprovada' | 'recusada' | 'cancelada';

export const ROTULO_STATUS_APROVACAO: Record<StatusAprovacao, string> = {
  pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada', cancelada: 'Cancelada'
};

export interface Aprovacao {
  id: number;
  tipo: string;
  tipoNome: string;
  entidadeTipo: string;
  entidadeId: string;
  titulo: string;
  valor: number | null;
  solicitanteId: string | null;
  solicitanteNome: string | null;
  status: StatusAprovacao;
  decisorNome: string | null;
  decididoEm: string | null;
  decisaoMotivo: string | null;
  criadoEm: string;
  /** Pendente e o usuário atual poderia decidir (regra de "outro decisor"); a permissão é checada no servidor. */
  podeDecidir: boolean;
}

export interface AprovacaoHistorico {
  acao: StatusAprovacao | 'solicitada';
  usuarioNome: string | null;
  motivo: string | null;
  criadoEm: string;
}

export interface AprovacaoDetalhe extends Aprovacao {
  historico: AprovacaoHistorico[];
}

export interface DecidirAprovacao { aprovar: boolean; motivo?: string | null; }

/** Rota da tela da entidade que originou o pedido (para o link "Abrir"). Tipos desconhecidos não têm link. */
export function rotaDaEntidade(a: Pick<Aprovacao, 'entidadeTipo' | 'entidadeId'>): string | null {
  return a.entidadeTipo === 'fin_titulo' ? `/financeiro/titulos/${a.entidadeId}` : null;
}
