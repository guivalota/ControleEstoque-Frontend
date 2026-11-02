export interface GradeValor {
  id: number;
  eixoId: number;
  codigo: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface GradeEixo {
  id: number;
  codigo: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  valores: GradeValor[];
}

export interface CreateGradeValorRequest { codigo: string; nome: string; ordem?: number; }

export interface GradeEixoSelecao { eixoId: number; valorIds: number[]; }

export interface GerarGradeRequest { eixos: GradeEixoSelecao[]; }

export interface VariacaoGrade {
  produtoId: number;
  sku: string;
  nome: string;
  ativo: boolean;
  saldo: number;
  /** eixoId -> valorId */
  valores: Record<string, number>;
}

export interface GradeProduto {
  produtoId: number;
  sku: string;
  nome: string;
  usaGrade: boolean;
  unidadeCodigo: string;
  saldoTotal: number;
  eixos: GradeEixo[];
  variacoes: VariacaoGrade[];
}

export interface GerarGradeResponse {
  criadas: number;
  puladas: number;
  grade: GradeProduto;
}
