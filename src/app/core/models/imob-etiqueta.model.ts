import { ImobBemFiltro } from './imob-bem.model';

export interface ImobEtiquetaModelo {
  codigo: string;
  descricao: string;
  etiquetaLarguraMm: number;
  etiquetaAlturaMm: number;
  etiquetasPorPagina: number;
}

/** Máximo de etiquetas por pedido aceito pelo servidor. */
export const LIMITE_ETIQUETAS = 500;
export const MODELO_ETIQUETA_PADRAO = 'a4-21';

/** O que imprimir: bens escolhidos (`ids`, que ignora os filtros) ou todos os do filtro. */
export interface ImobEtiquetaAlvo {
  ids?: number[];
  filtro?: ImobBemFiltro;
  /** Total conhecido de etiquetas, só para avisar quando passa do limite. */
  total?: number;
}

export interface ImobEtiquetaPedido extends ImobEtiquetaAlvo {
  modelo: string;
  bordas: boolean;
}
