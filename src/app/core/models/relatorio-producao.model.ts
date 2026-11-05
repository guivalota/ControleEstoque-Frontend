export interface CustoOrdem {
  ordemId: number;
  numero: number;
  produtoSku: string;
  produtoNome: string;
  concluidaEm: string;
  pecas: number;
  /** Custo por peça da ficha × peças; null se a ficha estava sem custo de algum material. */
  custoPadrao: number | null;
  insumos: number;
  maoDeObra: number;
  custosIndiretos: number;
  faccao: number;
  custoReal: number;
  /** Real − padrão (positivo = custou mais). */
  diferenca: number | null;
  diferencaPercentual: number | null;
}

export interface CustoOrdens {
  de: string;
  ate: string;
  ordens: CustoOrdem[];
  totalPadrao: number;
  totalReal: number;
  totalDiferenca: number;
  ordensSemCustoPadrao: number;
}

export interface ProducaoProduto {
  produtoId: number;
  produtoSku: string;
  produtoNome: string;
  quantidade: number;
  apontamentosComSobreproducao: number;
}

export interface PerdaTecido {
  materialId: number;
  materialNome: string;
  unidadeCodigo: string;
  cortes: number;
  consumido: number;
  consumoTeorico: number;
  consumoPrevisto: number;
  perdaRealPercentual: number | null;
  perdaPrevistaPercentual: number | null;
  aproveitamentoPercentual: number | null;
}

export interface OrdemAtrasada {
  ordemId: number;
  numero: number;
  produtoNome: string;
  status: string;
  prazo: string;
  diasDeAtraso: number;
}

export interface ProducaoPeriodo {
  de: string;
  ate: string;
  produtos: ProducaoProduto[];
  totalPecas: number;
  perdaDeTecido: PerdaTecido[];
  ordensAtrasadas: OrdemAtrasada[];
}

export interface DashboardProducao {
  ordensPorEstado: { status: string; quantidade: number }[];
  ordensAtrasadas: number;
  maisAtrasadas: OrdemAtrasada[];
  materiaisAComprar: number;
  materiaisPrioritarios: { materialId: number; materialNome: string; unidadeCodigo: string; aComprar: number; atrasada: boolean }[];
  remessasAbertas: number;
  remessasAtrasadas: number;
  pecasEmPoderDeOficinas: number;
}
