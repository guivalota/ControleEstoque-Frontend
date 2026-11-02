/** Tipos de item do Estoque (valores aceitos pelo back em `tipoItem`). */
export type TipoItem = 'revenda' | 'materia_prima' | 'aviamento' | 'embalagem' | 'semiacabado' | 'acabado' | 'consumo';

export const TIPOS_ITEM: { valor: TipoItem; rotulo: string }[] = [
  { valor: 'revenda', rotulo: 'Revenda' },
  { valor: 'materia_prima', rotulo: 'Matéria-prima' },
  { valor: 'aviamento', rotulo: 'Aviamento' },
  { valor: 'embalagem', rotulo: 'Embalagem' },
  { valor: 'semiacabado', rotulo: 'Semiacabado' },
  { valor: 'acabado', rotulo: 'Acabado' },
  { valor: 'consumo', rotulo: 'Consumo' }
];

export function rotuloTipoItem(tipo: string | undefined): string {
  return TIPOS_ITEM.find(t => t.valor === tipo)?.rotulo ?? (tipo ?? '');
}

export interface UnidadeMedida {
  codigo: string;
  nome: string;
  /** 0 = só inteiros; 1 a 3 = casas decimais aceitas. */
  casasDecimais: number;
}

export interface Produto {
  id: number;
  sku: string;
  nome: string;
  descricao?: string;
  categoriaId: number;
  categoriaNome?: string;
  precoUnitario: number;
  estoqueMinimo?: number;
  pontoReposicao?: number;
  ativo: boolean;
  fazParteEstoque: boolean;
  criadoEm?: string;
  tipoItem?: TipoItem;
  unidadeCodigo?: string;
  unidadeCompraCodigo?: string | null;
  fatorConversao?: number | null;
  unidadeCasasDecimais?: number;
  /** Modelo de uma grade (tamanho x cor): só as variações recebem movimentação. */
  usaGrade?: boolean;
  /** Preenchido nas variações de um modelo. */
  produtoPaiId?: number | null;
}

export interface CreateProdutoRequest {
  sku: string;
  nome: string;
  descricao?: string | null;
  categoriaId: number;
  precoUnitario: number;
  estoqueMinimo?: number;
  pontoReposicao?: number;
  fazParteEstoque?: boolean;
  tipoItem?: TipoItem;
  unidadeCodigo?: string;
  unidadeCompraCodigo?: string | null;
  fatorConversao?: number | null;
}

export interface UpdateProdutoRequest {
  sku?: string | null;
  nome?: string | null;
  descricao?: string | null;
  categoriaId?: number | null;
  precoUnitario?: number | null;
  ativo?: boolean | null;
  estoqueMinimo?: number | null;
  pontoReposicao?: number | null;
  fazParteEstoque?: boolean | null;
  tipoItem?: TipoItem | null;
  unidadeCodigo?: string | null;
  /** Texto vazio remove a conversão de compra. */
  unidadeCompraCodigo?: string | null;
  fatorConversao?: number | null;
}
