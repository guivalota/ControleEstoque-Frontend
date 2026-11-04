export interface FichaItem {
  materialId: number;
  materialSku: string;
  materialNome: string;
  variacaoId: number | null;
  variacaoSku: string | null;
  quantidade: number;
  perdaPercentual: number;
  unidadeCodigo: string;
  ordem: number;
}

export interface FichaTecnica {
  id: number;
  produtoId: number;
  produtoSku: string;
  produtoNome: string;
  versao: number;
  vigente: boolean;
  observacao: string | null;
  criadoPor: string | null;
  criadoEm: string;
  quantidadeItens: number;
  maoDeObra: number;
  custosIndiretos: number;
  /** Custo por peça (base comum) no momento da criação da versão; null se faltava custo de algum material. */
  custoPadraoNaCriacao: number | null;
  itens: FichaItem[];
}

export interface FichaItemRequest {
  materialId: number;
  variacaoId: number | null;
  quantidade: number;
  perdaPercentual: number;
}

export interface CreateFichaTecnicaRequest {
  produtoId: number;
  observacao: string | null;
  maoDeObra: number;
  custosIndiretos: number;
  itens: FichaItemRequest[];
}

export interface FichaConsumo {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  quantidade: number;
  perdaPercentual: number;
  quantidadeComPerda: number;
  propriaDaVariacao: boolean;
}

export interface FichaCustoMaterial {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  quantidadeComPerda: number;
  custoUnitario: number | null;
  custo: number | null;
}

/** Custo padrão por peça pelo custo médio ponderado de hoje; `custoTotal` é null enquanto houver material sem custo. */
export interface FichaCusto {
  fichaId: number;
  variacaoId: number | null;
  materiais: FichaCustoMaterial[];
  custoMateriais: number;
  maoDeObra: number;
  custosIndiretos: number;
  custoTotal: number | null;
  custoParcial: number;
  completo: boolean;
  materiaisSemCusto: string[];
}
