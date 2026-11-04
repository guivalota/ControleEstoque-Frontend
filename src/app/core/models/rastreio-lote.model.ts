export interface LoteConsumido {
  loteId: number;
  numeroLote: string;
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  quantidade: number;
}

export interface LoteGerado {
  loteId: number;
  numeroLote: string;
  produtoId: number;
  produtoSku: string;
  produtoNome: string;
  quantidade: number;
}

/** Lotes de material que a ordem consumiu e lotes de acabado que gerou. */
export interface OrdemLotes {
  ordemId: number;
  consumidos: LoteConsumido[];
  gerados: LoteGerado[];
}

export interface OrdemRastreada {
  ordemId: number;
  numero: number;
  status: string;
  produtoNome: string;
  /** Quanto desse lote a ordem consumiu (para a frente) ou gerou (para trás). */
  quantidade: number;
  lotesGerados: LoteGerado[];
  lotesConsumidos: LoteConsumido[];
}

export interface RastreioLote {
  lote: {
    id: number;
    numeroLote: string;
    produtoId: number;
    produtoSku: string;
    produtoNome: string;
    unidadeCodigo: string;
    dataValidade: string | null;
    quantidadeAtual: number;
  };
  /** Lote de material → ordens que o consumiram → lotes de acabado gerados. */
  usadoEm: OrdemRastreada[];
  /** Lote de acabado → ordem que o gerou → lotes de material consumidos. */
  geradoPor: OrdemRastreada[];
}
