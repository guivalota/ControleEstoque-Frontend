/** Campos customizados do bem (E27 / US-27-07). */

export type TipoCampoCustomizado = 'texto' | 'numero' | 'data' | 'lista';

export const TIPOS_CAMPO_CUSTOMIZADO: TipoCampoCustomizado[] = ['texto', 'numero', 'data', 'lista'];

export const ROTULO_TIPO_CAMPO: Record<TipoCampoCustomizado, string> = {
  texto: 'Texto', numero: 'Número', data: 'Data', lista: 'Lista de opções'
};

/** Regras iguais às do servidor (que é quem decide). */
export const MAX_CAMPOS_CUSTOMIZADOS = 20;
export const MAX_NOME_CAMPO = 40;
export const MAX_OPCOES_CAMPO = 50;
export const MAX_TEXTO_CAMPO = 500;

export interface ImobCampoCustomizado {
  id: number;
  nome: string;
  tipo: TipoCampoCustomizado;
  obrigatorio: boolean;
  opcoes: string[];
  categoriaId: number | null;
  categoriaNome?: string | null;
  ativo: boolean;
  ordem: number;
  /** Quantos bens têm valor neste campo (com valor, só dá para inativar). */
  bensComValor: number;
}

export interface CriarImobCampoCustomizado {
  nome: string;
  tipo: TipoCampoCustomizado;
  obrigatorio: boolean;
  opcoes?: string[];
  categoriaId?: number | null;
  ordem: number;
}

/** O tipo não muda depois de criado. */
export interface AtualizarImobCampoCustomizado {
  nome: string;
  obrigatorio: boolean;
  opcoes?: string[];
  categoriaId?: number | null;
  ativo: boolean;
  ordem: number;
}

/** Valor gravado de um campo no bem (data vem aaaa-MM-dd; número com ponto). */
export interface ImobBemCampoValor {
  campoId: number;
  nome: string;
  tipo: TipoCampoCustomizado;
  ativo: boolean;
  valor: string;
}

/** Item enviado com o bem: `valor` vazio/nulo limpa o campo. */
export interface ImobBemCampoValorEnviado {
  campoId: number;
  valor: string | null;
}
