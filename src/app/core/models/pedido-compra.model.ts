export type PedidoStatus = 'aberto' | 'atendido' | 'cancelado';

export interface PedidoCompraItem {
  id: number;
  produtoId: number;
  produtoNome: string;
  produtoSku: string;
  quantidadeSolicitada: number;
  quantidadeAtendida: number;
  percentualAtendido: number;
  observacao?: string;
  criadoEm: string;
}

export interface PedidoCompra {
  id: number;
  descricao: string;
  status: PedidoStatus;
  criadoPor: string;
  criadoPorNome: string;
  destinadoA?: string | null;
  destinadoANome?: string | null;
  observacao?: string | null;
  criadoEm: string;
  itens: PedidoCompraItem[];
}

export interface PedidoCompraFiltros {
  status?: PedidoStatus;
  criadoPor?: string;
  destinadoA?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePedidoCompraRequest {
  descricao: string;
  destinadoA?: string | null;
  observacao?: string | null;
  itens: CreatePedidoCompraItemRequest[];
}

export interface CreatePedidoCompraItemRequest {
  produtoId: number;
  quantidadeSolicitada: number;
  observacao?: string | null;
}

export interface UpdatePedidoCompraRequest {
  descricao?: string | null;
  destinadoA?: string | null;
  observacao?: string | null;
}

export interface AddPedidoItemRequest {
  produtoId: number;
  quantidadeSolicitada: number;
  observacao?: string | null;
}
