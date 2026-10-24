import { PagedResult } from './paged-result.model';

// --- Depreciação por bem (4.1) ---

export interface DepreciacaoPremissas {
  dataAquisicao: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilMeses: number;
  dataBaixa?: string | null;
}

export interface DepreciacaoResumo {
  baseDepreciavel: number;
  quotaMensal: number;
  ultimaQuota: number;
  competenciaInicial: string;
  competenciaFinalDaVida: string;
  ultimaCompetenciaDepreciada: string;
  totalQuotas: number;
  em: string;
  quotasAteEm: number;
  acumuladaEm: number;
  valorContabilEm: number;
  totalmenteDepreciado: boolean;
}

export interface PassoMemoriaCalculo {
  numero: number;
  titulo: string;
  regra: string;
  calculo: string;
  resultado: string;
}

export interface QuotaCronograma {
  numero: number;
  competencia: string;
  quota: number;
  acumulada: number;
  valorContabil: number;
}

export interface DepreciacaoBem {
  bemId: number;
  plaqueta: string;
  descricao: string;
  status: string;
  metodologiaVersao: string;
  situacao: 'calculada' | 'dados_incompletos';
  premissas?: DepreciacaoPremissas | null;
  resumo?: DepreciacaoResumo | null;
  memoriaDeCalculo: PassoMemoriaCalculo[];
  cronograma: PagedResult<QuotaCronograma>;
}

// --- Ajuda ---

export interface AjudaItem {
  slug: string;
  pergunta: string;
  /** Markdown. */
  resposta: string;
  validarComContador: boolean;
}

export interface AjudaSecao {
  slug: string;
  titulo: string;
  ordem: number;
  itens: AjudaItem[];
}

export interface AjudaDepreciacao {
  versao: string;
  atualizadoEm: string;
  aviso: string;
  secoes: AjudaSecao[];
}

// --- Totais, períodos e fechamento (4.2) ---

export interface TotaisPeriodo {
  totalBens: number;
  totalDepreciacao: number;
  totalAcumulada: number;
  totalValorContabil: number;
}

export interface LinhaPeriodo {
  bemId: number;
  plaqueta: string;
  descricao: string;
  categoriaId: number;
  categoriaNome?: string | null;
  localId: number;
  localNome?: string | null;
  responsavelId?: number | null;
  responsavelNome?: string | null;
  statusBem: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilMeses: number;
  dataAquisicao: string;
  dataBaixa?: string | null;
  saldoAbertura: number;
  quota: number;
  acumulada: number;
  valorContabil: number;
}

export interface PreviaDepreciacao {
  competencia: string;
  mes: string;
  metodologiaVersao: string;
  fechavel: boolean;
  motivoNaoFechavel?: string | null;
  jaFechada: boolean;
  totais: TotaisPeriodo;
  pendencias: { bensDadosIncompletos: number; bensEmOsDeBaixaOuVendaAberta: number; inventariosEmAndamento: number };
  avisos: string[];
  linhas: PagedResult<LinhaPeriodo>;
}

export interface PeriodoFechado extends TotaisPeriodo {
  competencia: string;
  mes: string;
  revisao: number;
  metodologiaVersao: string;
  fechadoPorId?: string | null;
  fechadoPorNome?: string | null;
  fechadoEm: string;
}

export interface ListaPeriodos {
  periodos: PagedResult<PeriodoFechado>;
  proximaCompetenciaAFechar?: string | null;
  ultimaCompetenciaFechavel?: string | null;
  mesesEncerradosSemFechamento: number;
}

export type EventoPeriodo = 'fechado' | 'reaberto' | 'refechado';

export interface EventoHistoricoPeriodo {
  id: number;
  evento: EventoPeriodo;
  revisao: number;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  ocorridoEm: string;
  motivo?: string | null;
  metodologiaVersao: string;
  totais?: TotaisPeriodo | null;
  totaisAnteriores?: TotaisPeriodo | null;
  variacao?: TotaisPeriodo | null;
}

export interface HistoricoPeriodo {
  competencia: string;
  mes: string;
  fechado: boolean;
  revisaoVigente?: number | null;
  eventos: EventoHistoricoPeriodo[];
}

export interface RevisaoPeriodo {
  competencia: string;
  mes: string;
  revisao: number;
  vigente: boolean;
  metodologiaVersao: string;
  totais: TotaisPeriodo;
  linhas: PagedResult<LinhaPeriodo>;
}

export type SituacaoDiferenca = 'alterado' | 'incluido' | 'removido';

export interface DiferencaRevisao {
  bemId: number;
  plaqueta: string;
  situacao: SituacaoDiferenca;
  camposAlterados: string[];
  antes?: (LinhaPeriodo & Record<string, unknown>) | null;
  depois?: (LinhaPeriodo & Record<string, unknown>) | null;
}

export interface ComparacaoRevisoes {
  competencia: string;
  mes: string;
  de: number;
  para: number;
  totaisDe: TotaisPeriodo;
  totaisPara: TotaisPeriodo;
  diferencas: PagedResult<DiferencaRevisao>;
}

// --- Relatórios (4.3) ---

export type AgruparRazao = 'bem' | 'categoria' | 'local' | 'responsavel' | 'status';
export type DimensaoRelatorio = 'categoria' | 'local' | 'responsavel' | 'status';

export interface LinhaRazao {
  chaveId?: number | null;
  nome: string;
  bemId?: number | null;
  descricao?: string | null;
  quantidade: number;
  valorAquisicao: number;
  saldoAbertura: number;
  quota: number;
  acumulada: number;
  valorContabil: number;
}

export interface RelatorioRazao {
  competencia: string;
  mes: string;
  revisao: number;
  vigente: boolean;
  metodologiaVersao: string;
  agrupar: AgruparRazao;
  totais: { quantidade: number; valorAquisicao: number; saldoAbertura: number; quota: number; acumulada: number; valorContabil: number };
  linhas: PagedResult<LinhaRazao>;
}

export interface ItemValorContabil {
  bemId: number;
  plaqueta: string;
  descricao: string;
  categoriaNome?: string | null;
  localNome?: string | null;
  responsavelNome?: string | null;
  status: string;
  dataAquisicao: string;
  valorAquisicao: number;
  valorResidual: number;
  vidaUtilMeses: number;
  acumulada: number;
  valorContabil: number;
}

export interface RelatorioValorContabil {
  em: string;
  metodologiaVersao: string;
  observacao: string;
  totais: { totalBens: number; totalValorAquisicao: number; totalAcumulada: number; totalValorContabil: number };
  bensDadosIncompletos: number;
  itens: PagedResult<ItemValorContabil>;
}

export interface LinhaDimensao {
  chaveId?: number | null;
  nome: string;
  quantidade: number;
  valorAquisicao: number;
  acumulada: number;
  valorContabil: number;
}

export interface RelatorioBensPorDimensao {
  por: DimensaoRelatorio;
  em: string;
  metodologiaVersao: string;
  totais: LinhaDimensao;
  linhas: LinhaDimensao[];
}

export interface ItemBaixa {
  bemId: number;
  plaqueta: string;
  descricao: string;
  categoriaNome?: string | null;
  status: string;
  dataBaixa: string;
  osId?: number | null;
  osNumero?: number | null;
  valorAquisicao: number;
  depreciacaoAcumulada: number;
  valorContabil: number;
}

export interface OrdemBaixa {
  osId: number;
  osNumero: number;
  tipo: string;
  dataBaixa: string;
  quantidade: number;
  valorContabil: number;
  valorVenda?: number | null;
  ganhoPerda?: number | null;
}

export interface RelatorioBaixas {
  de: string;
  ate: string;
  metodologiaVersao: string;
  totais: { quantidade: number; valorContabil: number; totalVendas: number; ganhoPerdaTotal: number };
  itens: PagedResult<ItemBaixa>;
  ordens: OrdemBaixa[];
}

// --- Painel (4.4) ---

export interface AlertaDepreciacao {
  codigo: string;
  severidade: 'info' | 'aviso' | 'critico';
  mensagem: string;
  quantidade: number;
  destino: string;
}

export interface PainelDepreciacao {
  em: string;
  metodologiaVersao: string;
  totais: LinhaDimensao;
  porCategoria: LinhaDimensao[];
  porStatus: LinhaDimensao[];
  ultimosFechamentos: PeriodoFechado[];
  proximaCompetenciaAFechar?: string | null;
  ultimaCompetenciaFechavel?: string | null;
  mesesEncerradosSemFechamento: number;
  alertas: AlertaDepreciacao[];
}

export const ROTULO_CAMPO_DIFERENCA: Record<string, string> = {
  quota: 'Quota',
  acumulada: 'Depreciação acumulada',
  valorContabil: 'Valor contábil',
  valorAquisicao: 'Valor de aquisição',
  valorResidual: 'Valor residual',
  vidaUtilMeses: 'Vida útil (meses)',
  dataAquisicao: 'Data de aquisição',
  dataBaixa: 'Data da baixa',
  categoriaId: 'Categoria',
  localId: 'Local',
  responsavelId: 'Responsável',
  statusBem: 'Status'
};

/** Competência `yyyy-MM-dd` (ou `yyyy-MM`) → `MM/yyyy`, sem `Date`. */
export function formatarMes(valor: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(valor ?? '');
  return m ? `${m[2]}/${m[1]}` : '—';
}
