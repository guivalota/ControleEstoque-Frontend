import { DeParaItem } from '../models/imob-renovacao.model';

export const MAX_PARES_DE_PARA = 5000;
export const MAX_CODIGO = 50;

export interface ParDePara extends DeParaItem {
  /** Número da linha no texto de origem (1-based, contando linhas vazias e cabeçalho). */
  linha: number;
}

const CAB_ANTIGA = new Set(['antiga', 'antigo', 'anterior', 'de', 'plaqueta antiga', 'plaqueta anterior']);
const CAB_NOVA = new Set(['nova', 'novo', 'atual', 'para', 'plaqueta nova', 'plaqueta atual']);

function limpar(celula: string): string {
  let t = celula.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).replace(/""/g, '"').trim();
  return t;
}

function dividir(linha: string): string[] {
  const sep = linha.includes(';') ? ';' : linha.includes('\t') ? '\t' : ',';
  return linha.split(sep).map(limpar);
}

/**
 * Lê `antiga;nova` (aceita `;`, `,` ou tabulação — colagem do Excel), com ou sem cabeçalho.
 * Faz trim, ignora linhas vazias e preserva o número da linha original.
 */
export function parsearDePara(texto: string): ParDePara[] {
  const semBom = texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
  const linhas = semBom.split(/\r\n|\r|\n/);
  const pares: ParDePara[] = [];
  let primeira = true;
  linhas.forEach((bruta, i) => {
    if (!bruta.trim()) return;
    const [antiga = '', nova = ''] = dividir(bruta);
    if (primeira) {
      primeira = false;
      if (CAB_ANTIGA.has(antiga.toLowerCase()) && CAB_NOVA.has(nova.toLowerCase())) return;
    }
    pares.push({ linha: i + 1, antiga, nova });
  });
  return pares;
}

export type TipoErroDePara = 'vazia' | 'excesso' | 'igual' | 'antiga_repetida' | 'nova_repetida';

export interface ErroDePara { linha: number; tipo: TipoErroDePara; mensagem: string }

export interface PreviaDePara {
  total: number;
  vazias: number;
  excesso: number;
  iguais: number;
  /** Quantidade de linhas cuja antiga aparece mais de uma vez. */
  antigasRepetidas: number;
  novasRepetidas: number;
  erros: ErroDePara[];
  /** Há erro que impede o envio. */
  bloqueado: boolean;
  /** Passa de 5000 pares: precisa dividir o arquivo. */
  excedeLimite: boolean;
}

/** Validações locais do arquivo (o cruzamento com o cadastro é feito por `cruzarComCadastro`). */
export function validarDePara(pares: ParDePara[]): PreviaDePara {
  const erros: ErroDePara[] = [];
  const contagem = (valores: string[]) => {
    const m = new Map<string, number>();
    for (const v of valores) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const antigas = contagem(pares.map(p => p.antiga));
  const novas = contagem(pares.map(p => p.nova));
  let vazias = 0, excesso = 0, iguais = 0, antigasRepetidas = 0, novasRepetidas = 0;

  for (const p of pares) {
    if (!p.antiga || !p.nova) {
      vazias++;
      erros.push({
        linha: p.linha, tipo: 'vazia',
        mensagem: !p.antiga && !p.nova ? 'Antiga e nova vazias.' : !p.antiga ? 'Código antigo vazio.' : 'Código novo vazio.'
      });
    }
    if (p.antiga.length > MAX_CODIGO || p.nova.length > MAX_CODIGO) {
      excesso++;
      erros.push({ linha: p.linha, tipo: 'excesso', mensagem: `Código com mais de ${MAX_CODIGO} caracteres.` });
    }
    if (p.antiga && p.antiga === p.nova) {
      iguais++;
      erros.push({ linha: p.linha, tipo: 'igual', mensagem: 'Código novo igual ao antigo.' });
    }
    if (p.antiga && (antigas.get(p.antiga) ?? 0) > 1) {
      antigasRepetidas++;
      erros.push({ linha: p.linha, tipo: 'antiga_repetida', mensagem: `Código antigo "${p.antiga}" repetido no arquivo.` });
    }
    if (p.nova && (novas.get(p.nova) ?? 0) > 1) {
      novasRepetidas++;
      erros.push({ linha: p.linha, tipo: 'nova_repetida', mensagem: `Código novo "${p.nova}" repetido no arquivo.` });
    }
  }

  return {
    total: pares.length, vazias, excesso, iguais, antigasRepetidas, novasRepetidas, erros,
    bloqueado: erros.length > 0 || pares.length === 0,
    excedeLimite: pares.length > MAX_PARES_DE_PARA
  };
}

export type SituacaoCadastro = 'ok' | 'ja_aplicado' | 'antiga_nao_encontrada' | 'nova_em_uso' | 'antiga_ja_substituida';

export const ROTULO_SITUACAO_CADASTRO: Record<SituacaoCadastro, string> = {
  ok: 'Será atualizado',
  ja_aplicado: 'Já aplicado',
  antiga_nao_encontrada: 'Antiga não encontrada no cadastro',
  nova_em_uso: 'Nova já usada por outro bem',
  antiga_ja_substituida: 'Antiga já aponta para outra plaqueta nova'
};

export interface BemCodigos { plaqueta: string; plaquetaAnterior?: string | null }

export interface ResultadoCruzamento {
  porLinha: Map<number, SituacaoCadastro>;
  contagem: Record<SituacaoCadastro, number>;
}

/** Cruza os pares com os códigos cadastrados (plaqueta atual e anterior de cada bem). */
export function cruzarComCadastro(pares: ParDePara[], bens: BemCodigos[]): ResultadoCruzamento {
  const porPlaqueta = new Map<string, BemCodigos>();
  const porAnterior = new Map<string, BemCodigos>();
  for (const b of bens) {
    porPlaqueta.set(b.plaqueta, b);
    if (b.plaquetaAnterior) porAnterior.set(b.plaquetaAnterior, b);
  }
  const porLinha = new Map<number, SituacaoCadastro>();
  const contagem: Record<SituacaoCadastro, number> = {
    ok: 0, ja_aplicado: 0, antiga_nao_encontrada: 0, nova_em_uso: 0, antiga_ja_substituida: 0
  };
  for (const p of pares) {
    let s: SituacaoCadastro;
    const noAnterior = porAnterior.get(p.antiga);
    if (noAnterior) s = noAnterior.plaqueta === p.nova ? 'ja_aplicado' : 'antiga_ja_substituida';
    else if (!porPlaqueta.has(p.antiga)) s = 'antiga_nao_encontrada';
    else if (porPlaqueta.has(p.nova) || porAnterior.has(p.nova)) s = 'nova_em_uso';
    else s = 'ok';
    porLinha.set(p.linha, s);
    contagem[s]++;
  }
  return { porLinha, contagem };
}

export const MODELO_CSV_DE_PARA = 'antiga;nova\r\n1001;A-0001\r\n1002;A-0002\r\n1003;A-0003\r\n';

/** O servidor bloqueia o de-para enquanto houver inventário em andamento. */
export function erroInventarioEmAndamento(mensagem: string): boolean {
  return /invent[aá]rio/i.test(mensagem) && /andamento/i.test(mensagem);
}
