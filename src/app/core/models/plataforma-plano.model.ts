/** Códigos de limite aceitos pelo servidor (`SalvarPlanoRequest.limites` e sobrescritas da empresa). */
export type CodigoLimite = 'max_usuarios' | 'max_bens' | 'max_produtos';

export const LIMITES: { codigo: CodigoLimite; rotulo: string }[] = [
  { codigo: 'max_usuarios', rotulo: 'Usuários' },
  { codigo: 'max_bens', rotulo: 'Bens (Imobilizado)' },
  { codigo: 'max_produtos', rotulo: 'Produtos (Estoque)' }
];

/** Módulos contratáveis conhecidos (o back não expõe catálogo fora de uma empresa). */
export const MODULOS_CONHECIDOS: { codigo: string; rotulo: string }[] = [
  { codigo: 'estoque', rotulo: 'Estoque' },
  { codigo: 'imobilizado', rotulo: 'Imobilizado' }
];

export interface Plano {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  modulos: string[];
  /** Código → valor; código ausente = ilimitado. */
  limites: Record<string, number>;
  padrao: boolean;
  ativo: boolean;
  empresasUsando: number;
}

export interface SalvarPlano {
  /** `^[a-z0-9_-]{2,40}$` */
  codigo: string;
  nome: string;
  descricao?: string | null;
  modulos: string[];
  limites?: Record<string, number> | null;
  padrao: boolean;
}

export interface DefinirPlanoDaEmpresa {
  planoId: number | null;
  sincronizarModulos: boolean;
}

/** Origem do limite: sobrescrita da empresa, plano ou ilimitado. */
export type OrigemLimite = 'empresa' | 'plano' | 'ilimitado';

export interface UsoLimite {
  codigo: string;
  descricao: string;
  usado: number;
  /** Nulo = ilimitado. */
  limite: number | null;
  origem: OrigemLimite | string;
}

export interface UsoEmpresa {
  planoId?: number | null;
  planoNome?: string | null;
  limites: UsoLimite[];
}
