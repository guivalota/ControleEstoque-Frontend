/** Cadastros do Financeiro (E24 / US-24-02): contas, categorias e centros de custo. Contrato: `v1/financeiro/*`. */

export type TipoConta = 'caixa' | 'banco';
export type NaturezaCategoria = 'receita' | 'despesa';

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = { caixa: 'Caixa', banco: 'Banco' };
export const ROTULO_NATUREZA: Record<NaturezaCategoria, string> = { receita: 'Receita', despesa: 'Despesa' };

/** A árvore de categorias vai até 3 níveis. */
export const MAX_NIVEIS_CATEGORIA = 3;

export interface ContaFin {
  id: number;
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
  /** Data (yyyy-MM-dd) a que o saldo inicial se refere. */
  dataSaldoInicial: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarContaFin { nome: string; tipo: TipoConta; saldoInicial: number; dataSaldoInicial?: string | null; }
export interface AtualizarContaFin { nome?: string; tipo?: TipoConta; saldoInicial?: number; dataSaldoInicial?: string | null; ativo?: boolean; }

export interface CategoriaFin {
  id: number;
  nome: string;
  natureza: NaturezaCategoria;
  paiId: number | null;
  nivel: number;
  ativo: boolean;
  criadoEm: string;
}

/** Na raiz a natureza é obrigatória; nas filhas é a do pai. */
export interface CriarCategoriaFin { nome: string; natureza?: NaturezaCategoria | null; paiId?: number | null; }
export interface AtualizarCategoriaFin { nome?: string; ativo?: boolean; }

export interface CentroCustoFin { id: number; nome: string; ativo: boolean; criadoEm: string; }
export interface CriarCentroCustoFin { nome: string; }
export interface AtualizarCentroCustoFin { nome?: string; ativo?: boolean; }

/** Categoria na ordem da árvore (pai antes dos filhos), com o recuo para exibir. */
export interface NoCategoria { categoria: CategoriaFin; nivel: number; }

/** Ordena a lista plana em árvore: raízes por natureza e nome; cada filha logo abaixo do pai. Órfã (pai fora da lista) vira raiz. */
export function montarArvoreCategorias(lista: readonly CategoriaFin[]): NoCategoria[] {
  const ids = new Set(lista.map(c => c.id));
  const porPai = new Map<number | null, CategoriaFin[]>();
  for (const c of lista) {
    const pai = c.paiId !== null && ids.has(c.paiId) ? c.paiId : null;
    porPai.set(pai, [...(porPai.get(pai) ?? []), c]);
  }
  const ordenar = (a: CategoriaFin, b: CategoriaFin) =>
    a.natureza.localeCompare(b.natureza) || a.nome.localeCompare(b.nome, 'pt-BR');
  const saida: NoCategoria[] = [];
  const visitar = (pai: number | null, nivel: number) => {
    for (const c of [...(porPai.get(pai) ?? [])].sort(ordenar)) {
      saida.push({ categoria: c, nivel });
      visitar(c.id, nivel + 1);
    }
  };
  visitar(null, 0);
  return saida;
}
