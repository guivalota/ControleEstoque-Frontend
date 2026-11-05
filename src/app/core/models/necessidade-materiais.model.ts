/** Material pedido pelas ordens abertas: necessário − estoque − em pedido = a comprar. */
export interface NecessidadeMaterial {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  necessario: number;
  estoque: number;
  reservado: number;
  emPedido: number;
  aComprar: number;
  ordens: number;
  prazoDaOrdem: string | null;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  prazoEntregaDias: number | null;
  /** Último dia para comprar e ainda cumprir o prazo da ordem; null sem prazo da ordem ou de entrega. */
  comprarAte: string | null;
  atrasada: boolean;
}

export interface PedidoGerado {
  pedidoId: number;
  fornecedorNome: string;
  itens: number;
}

export interface PedidosGerados {
  pedidos: PedidoGerado[];
  /** Materiais que precisam de compra mas não têm fornecedor preferencial. */
  semFornecedor: string[];
}
