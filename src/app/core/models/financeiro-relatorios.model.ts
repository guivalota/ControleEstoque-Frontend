/** Fluxo de caixa, relatórios, configurações e importações do Financeiro (E24). */

export type AgruparFluxo = 'dia' | 'semana' | 'mes';

export interface FluxoPeriodo {
  inicio: string;
  fim: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  /** Saldo das contas ao fim do período, só com o que foi baixado. */
  saldoRealizado: number;
  /** Saldo realizado + previsto acumulado desde o início do relatório. */
  saldoProjetado: number;
}

export interface FluxoConta {
  contaId: number;
  nome: string;
  tipo: string;
  ativo: boolean;
  saldoInicial: number;
  dataSaldoInicial: string;
  saldoFinal: number;
}

export interface FluxoCaixa {
  de: string;
  ate: string;
  agrupar: AgruparFluxo;
  contaId: number | null;
  /** Falso quando o relatório é de uma conta só (títulos abertos não pertencem a conta). */
  previstoIncluido: boolean;
  periodos: FluxoPeriodo[];
  contas: FluxoConta[];
  totalEntradasPrevistas: number;
  totalSaidasPrevistas: number;
  totalEntradasRealizadas: number;
  totalSaidasRealizadas: number;
}

export interface FiltroFluxo {
  de?: string;
  ate?: string;
  agrupar?: AgruparFluxo;
  contaId?: number | null;
}

export type NomeRelatorioFin = 'vencimentos' | 'aging' | 'por-categoria' | 'extrato-pessoa';
export const ROTULO_RELATORIO_FIN: Record<NomeRelatorioFin, string> = {
  vencimentos: 'Vencimentos', aging: 'Aging (atrasos por faixa)', 'por-categoria': 'Títulos por categoria', 'extrato-pessoa': 'Extrato por pessoa'
};

export interface FiltroRelatorioFin {
  de?: string;
  ate?: string;
  tipo?: 'pagar' | 'receber' | '';
  categoriaId?: number | null;
  centroCustoId?: number | null;
  posicao?: string;
  fornecedorId?: number | null;
  clienteId?: number | null;
}

export interface RelatorioColuna { titulo: string; numerica: boolean; }

/** A mesma tabela alimenta a tela, o CSV e o PDF (base do Core). Células: texto, número, data `aaaa-mm-dd` ou nulo. */
export interface RelatorioTabela {
  titulo: string;
  contexto: string[];
  colunas: RelatorioColuna[];
  linhas: (string | number | null)[][];
  totais: (string | number | null)[] | null;
}

export interface FinConfiguracao {
  aprovacaoValorMinimo: number;
  prazoPadraoDias: number;
  categoriaPadraoPagarId: number | null;
  categoriaPadraoPagarNome: string | null;
  recorrenciaHorizonteMeses: number;
}

export interface SalvarFinConfiguracao {
  aprovacaoValorMinimo: number;
  prazoPadraoDias: number;
  categoriaPadraoPagarId: number | null;
  recorrenciaHorizonteMeses: number;
}

export type SituacaoImportacao = 'aguardando' | 'automatico' | 'erro';

export interface Importacao {
  id: number;
  tipo: string;
  tipoNome: string;
  descricao: string;
  pessoa: string | null;
  valor: number | null;
  data: string | null;
  situacao: SituacaoImportacao;
  tentativas: number;
  ultimoErro: string | null;
  criadoEm: string;
}

export interface AjustesImportacao { vencimento?: string | null; categoriaId?: number | null; }

export const ROTULO_SITUACAO_IMPORTACAO: Record<SituacaoImportacao, string> = {
  aguardando: 'Aguardando confirmação', automatico: 'Entra sozinho', erro: 'Falhou'
};
