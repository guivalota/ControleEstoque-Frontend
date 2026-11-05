export type StatusOrdemProducao = 'planejada' | 'liberada' | 'em_producao' | 'concluida' | 'cancelada';

export const ROTULO_STATUS_ORDEM: Record<StatusOrdemProducao, string> = {
  planejada: 'Planejada',
  liberada: 'Liberada',
  em_producao: 'Em produção',
  concluida: 'Concluída',
  cancelada: 'Cancelada'
};

export interface OrdemProducaoItem {
  variacaoId: number | null;
  variacaoSku: string | null;
  quantidade: number;
  /** Peças já apontadas desta variação. */
  apontado: number;
  /** Peças já cortadas desta variação. */
  cortado: number;
}

export interface OrdemProducaoMaterial {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  necessidade: number;
  reservado: number;
  /** Quanto já foi baixado do estoque pelos apontamentos. */
  consumido: number;
  /** O corte já baixou este material; o apontamento não baixa de novo. */
  baixaNoCorte: boolean;
  saldo: number;
  disponivel: number;
  falta: number;
}

export interface OrdemProducaoEvento {
  deStatus: StatusOrdemProducao | null;
  paraStatus: StatusOrdemProducao;
  motivo: string | null;
  usuarioNome: string | null;
  criadoEm: string;
}

export interface OrdemProducao {
  id: number;
  numero: number;
  produtoId: number;
  produtoSku: string;
  produtoNome: string;
  fichaId: number;
  fichaVersao: number;
  /** Mão de obra e custos indiretos por peça da ficha: o que a tela sugere ao apontar (quem opera pode alterar ou zerar). */
  fichaMaoDeObra: number;
  fichaCustosIndiretos: number;
  status: StatusOrdemProducao;
  prazo: string | null;
  observacao: string | null;
  criadoEm: string;
  quantidadeTotal: number;
  itens: OrdemProducaoItem[];
  materiais: OrdemProducaoMaterial[];
  historico: OrdemProducaoEvento[];
}

export interface CreateOrdemProducaoRequest {
  produtoId: number;
  prazo: string | null;
  observacao: string | null;
  itens: { variacaoId: number | null; quantidade: number }[];
}

export interface FaltaMaterial {
  materialId: number;
  materialNome: string;
  unidadeCodigo: string;
  necessidade: number;
  reservavel: number;
  falta: number;
}

/** `liberada: false` = nada mudou; mostre `faltas` e peça a confirmação explícita. */
export interface LiberacaoOrdem {
  liberada: boolean;
  faltas: FaltaMaterial[];
  ordem: OrdemProducao;
}

export interface ApontamentoConsumo {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  previsto: number;
  real: number;
  custoUnitario: number | null;
  motivo: string | null;
}

export interface Apontamento {
  id: number;
  variacaoId: number | null;
  variacaoSku: string | null;
  quantidade: number;
  sobreproducao: boolean;
  /** Custo por peça com que o acabado entrou no estoque (materiais, tecido do corte, mão de obra e indiretos). */
  custoUnitario: number | null;
  maoDeObraUnitaria: number;
  custosIndiretosUnitarios: number;
  observacao: string | null;
  usuarioNome: string | null;
  criadoEm: string;
  consumos: ApontamentoConsumo[];
}

export interface ApontarProducaoRequest {
  confirmarSobreproducao: boolean;
  observacao: string | null;
  /** Por peça; omitido = o da ficha da ordem; 0 = não considerar no custo. */
  maoDeObraPorPeca?: number | null;
  custosIndiretosPorPeca?: number | null;
  itens: { variacaoId: number | null; quantidade: number; consumos: { materialId: number; quantidade: number; motivo: string | null }[] }[];
}

export interface Sobreproducao {
  variacaoId: number | null;
  variacaoSku: string | null;
  planejado: number;
  apontado: number;
  excesso: number;
}

/** `registrado: false` = nada foi gravado; mostre `sobreproducao` e peça a confirmação. */
export interface ApontamentoRegistrado {
  registrado: boolean;
  ordemConcluida: boolean;
  sobreproducao: Sobreproducao[];
  ordem: OrdemProducao;
}
