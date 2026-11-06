/** Títulos a pagar e a receber, baixas, parcelamento e recorrência do Financeiro (E24). Contrato: `v1/financeiro/*`. */

export type TipoTitulo = 'pagar' | 'receber';
export type StatusTitulo = 'aberto' | 'parcial' | 'quitado' | 'cancelado';
/** Filtro de situação da lista: os estados gravados mais `vencido` (aberto/parcial com vencimento anterior a hoje). */
export type FiltroStatusTitulo = StatusTitulo | 'vencido';
export type StatusAprovacaoTitulo = 'pendente' | 'aprovada' | 'recusada' | 'cancelada';
export type FormaPagamento = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao' | 'outro';

export const ROTULO_TIPO_TITULO: Record<TipoTitulo, string> = { pagar: 'A pagar', receber: 'A receber' };
export const ROTULO_STATUS_TITULO: Record<StatusTitulo, string> = {
  aberto: 'Em aberto', parcial: 'Parcial', quitado: 'Quitado', cancelado: 'Cancelado'
};
export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: 'PIX', boleto: 'Boleto', transferencia: 'Transferência', dinheiro: 'Dinheiro', cartao: 'Cartão', outro: 'Outro'
};
export const FORMAS_PAGAMENTO = Object.keys(ROTULO_FORMA) as FormaPagamento[];

export interface Titulo {
  id: number;
  tipo: TipoTitulo;
  fornecedorId: number | null;
  clienteId: number | null;
  /** Nome exibido: o do cadastro (fornecedor/cliente) ou o digitado. */
  pessoaNome: string | null;
  descricao: string;
  documento: string | null;
  valor: number;
  saldo: number;
  emissao: string;
  vencimento: string;
  competencia: string;
  categoriaId: number;
  categoriaNome: string | null;
  centroCustoId: number | null;
  centroCustoNome: string | null;
  status: StatusTitulo;
  vencido: boolean;
  origem: string | null;
  origemId: string | null;
  aprovacaoId: number | null;
  /** `pendente` bloqueia a baixa; `aprovada` libera. */
  aprovacaoStatus: StatusAprovacaoTitulo | null;
  grupoId: string | null;
  parcela: number | null;
  totalParcelas: number | null;
  recorrenciaId: number | null;
  canceladoMotivo: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TituloEvento {
  id: number;
  tipo: string;
  usuarioNome: string | null;
  /** JSON com o que mudou. */
  detalhe: string | null;
  criadoEm: string;
}

export interface Baixa {
  id: number;
  contaId: number;
  contaNome: string | null;
  data: string;
  forma: FormaPagamento;
  valor: number;
  juros: number;
  multa: number;
  desconto: number;
  /** Dinheiro que movimentou a conta: principal + juros + multa (o desconto só abate o saldo). */
  totalPago: number;
  observacao: string | null;
  estornada: boolean;
  estornadaEm: string | null;
  estornoMotivo: string | null;
  estornadaPorNome: string | null;
  criadoPorNome: string | null;
  criadoEm: string;
}

export interface TituloDetalhe extends Titulo {
  eventos: TituloEvento[];
  baixas: Baixa[];
}

export interface FiltroTitulos {
  tipo?: TipoTitulo | '';
  status?: FiltroStatusTitulo | '';
  fornecedorId?: number | null;
  clienteId?: number | null;
  categoriaId?: number | null;
  centroCustoId?: number | null;
  vencimentoDe?: string;
  vencimentoAte?: string;
  /** Mês no formato `aaaa-mm`. */
  competencia?: string;
  origem?: string;
  busca?: string;
  grupoId?: string;
  recorrenciaId?: number | null;
  page?: number;
  pageSize?: number;
}

export interface CriarTitulo {
  tipo: TipoTitulo;
  fornecedorId?: number | null;
  clienteId?: number | null;
  pessoaNome?: string | null;
  descricao: string;
  documento?: string | null;
  valor: number;
  emissao?: string | null;
  vencimento: string;
  competencia?: string | null;
  categoriaId: number;
  centroCustoId?: number | null;
}

/** O tipo nunca muda; os demais campos substituem os atuais. */
export type AtualizarTitulo = Omit<CriarTitulo, 'tipo' | 'emissao'> & { emissao: string };

export interface CriarTituloParcelado extends CriarTitulo {
  /** `valor` é o TOTAL, dividido em `parcelas` títulos mensais (a última ajusta os centavos). */
  parcelas: number;
}

export interface TituloParcelado {
  grupoId: string;
  valorTotal: number;
  titulos: Titulo[];
}

export interface CriarBaixa {
  contaId: number;
  data?: string | null;
  forma: FormaPagamento;
  valor: number;
  juros: number;
  multa: number;
  desconto: number;
  observacao?: string | null;
}

export interface Recorrencia {
  id: number;
  tipo: TipoTitulo;
  fornecedorId: number | null;
  clienteId: number | null;
  pessoaNome: string | null;
  descricao: string;
  documento: string | null;
  valor: number;
  diaVencimento: number;
  categoriaId: number;
  categoriaNome: string | null;
  centroCustoId: number | null;
  centroCustoNome: string | null;
  inicio: string;
  fim: string | null;
  ativo: boolean;
  ultimaCompetencia: string | null;
  criadoEm: string;
}

export interface CriarRecorrencia {
  tipo: TipoTitulo;
  fornecedorId?: number | null;
  clienteId?: number | null;
  pessoaNome?: string | null;
  descricao: string;
  documento?: string | null;
  valor: number;
  diaVencimento: number;
  categoriaId: number;
  centroCustoId?: number | null;
  inicio: string;
  fim?: string | null;
}

export interface AtualizarRecorrencia {
  descricao?: string;
  documento?: string;
  valor?: number;
  diaVencimento?: number;
  categoriaId?: number;
  centroCustoId?: number;
  fim?: string;
  limparFim?: boolean;
  ativo?: boolean;
}

/** Situação do pedido de aprovação, em português, para o selo do título. */
export const ROTULO_APROVACAO: Record<StatusAprovacaoTitulo, string> = {
  pendente: 'Aguardando aprovação', aprovada: 'Aprovado', recusada: 'Recusado', cancelada: 'Aprovação cancelada'
};

/** Rótulo do histórico do título (`tipo` do evento). */
export const ROTULO_EVENTO: Record<string, string> = {
  criacao: 'Título criado', alteracao: 'Título alterado', cancelamento: 'Título cancelado', baixa: 'Baixa registrada',
  estorno: 'Baixa estornada', aprovacao_solicitada: 'Aprovação solicitada', aprovacao_aprovada: 'Pagamento aprovado',
  aprovacao_recusada: 'Pagamento recusado', aprovacao_invalidada: 'Aprovação invalidada'
};

/** O título aceita baixa agora (aberto/parcial e sem pedido de aprovação pendente). */
export function podeBaixar(t: Pick<Titulo, 'status' | 'aprovacaoId' | 'aprovacaoStatus'>): boolean {
  if (t.status !== 'aberto' && t.status !== 'parcial') return false;
  return t.aprovacaoId === null || t.aprovacaoStatus === 'aprovada';
}

/** Primeiro dia do mês de `aaaa-mm-dd` no formato `aaaa-mm` (filtro de competência). */
export function mesDe(data: string): string { return data.slice(0, 7); }
