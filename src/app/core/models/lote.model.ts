export interface Lote {
  id: number;
  produtoId: number;
  numeroLote: string;
  dataFabricacao?: string | null;
  dataValidade?: string | null;
  quantidadeInicial: number;
  quantidadeAtual: number;
  fornecedorId?: number | null;
  observacao?: string | null;
  criadoEm: string;
}

export interface CreateLoteRequest {
  produtoId: number;
  numeroLote: string;
  dataFabricacao?: string | null;
  dataValidade?: string | null;
  quantidadeInicial: number;
  fornecedorId?: number | null;
  observacao?: string | null;
}

export interface UpdateLoteRequest {
  numeroLote?: string | null;
  dataFabricacao?: string | null;
  dataValidade?: string | null;
  quantidadeInicial?: number | null;
  fornecedorId?: number | null;
  observacao?: string | null;
}

export interface LoteFiltros {
  ProdutoId?: number;
  Vencidos?: boolean;
  Vencendo?: boolean;
  DiasVencendo?: number;
  Page?: number;
  PageSize?: number;
}

export interface LotePage {
  items: Lote[];
  total: number;
}

export type SituacaoLote = 'vencido' | 'vencendo' | 'ok' | 'sem_validade';

/** Dias até a validade (negativo = vencido); `hoje` no formato yyyy-MM-dd evita parse de Date com fuso. */
export function diasParaVencer(validade: string | null | undefined, hoje = hojeIso()): number | null {
  if (!validade) return null;
  const dia = (iso: string) => {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(a, m - 1, d) / 86_400_000;
  };
  return Math.round(dia(validade) - dia(hoje));
}

export function situacaoLote(validade: string | null | undefined, diasAlerta = 30, hoje = hojeIso()): SituacaoLote {
  const dias = diasParaVencer(validade, hoje);
  if (dias === null) return 'sem_validade';
  if (dias < 0) return 'vencido';
  return dias <= diasAlerta ? 'vencendo' : 'ok';
}

function hojeIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
