/** Regras de plaqueta da replicação de bens (E27 / US-27-02). O servidor repete a conferência; aqui serve à prévia. */

export const MAX_REPLICACAO = 500;
export const TAMANHO_MAX_PLAQUETA = 50;

export interface SequenciaPlaqueta {
  prefixo: string;
  numeroInicial: number;
  largura: number;
  quantidade: number;
}

/** Separa o sufixo numérico da plaqueta e sugere a sequência seguinte: `CAD-007` → prefixo `CAD-`, início 8, largura 3. */
export function sugerirSequencia(plaqueta: string): Pick<SequenciaPlaqueta, 'prefixo' | 'numeroInicial' | 'largura'> {
  const m = /^(.*?)(\d+)$/.exec(plaqueta.trim());
  if (!m || m[2].length > 9) return { prefixo: plaqueta.trim() ? plaqueta.trim() + '-' : '', numeroInicial: 1, largura: 0 };
  const numero = Number(m[2]);
  return { prefixo: m[1], numeroInicial: numero + 1, largura: m[2].length };
}

export function gerarSequencia(s: SequenciaPlaqueta): string[] {
  const qtd = Math.max(0, Math.floor(s.quantidade || 0));
  return Array.from({ length: qtd }, (_, i) => s.prefixo.trim() + String(s.numeroInicial + i).padStart(Math.max(0, s.largura || 0), '0'));
}

/** Uma plaqueta por linha (ou separadas por vírgula/ponto e vírgula); vazias são ignoradas. */
export function lerListaPlaquetas(texto: string): string[] {
  return texto.split(/[\n,;]+/).map(p => p.trim()).filter(p => p.length > 0);
}

/** Mensagem de erro da lista (ou `null` se estiver tudo certo); o servidor ainda confere colisão com bens existentes. */
export function validarPlaquetas(plaquetas: string[]): string | null {
  if (plaquetas.length < 1) return 'Informe ao menos uma plaqueta.';
  if (plaquetas.length > MAX_REPLICACAO) return `No máximo ${MAX_REPLICACAO} cópias por vez.`;
  if (plaquetas.some(p => p.length > TAMANHO_MAX_PLAQUETA)) return `Há plaqueta com mais de ${TAMANHO_MAX_PLAQUETA} caracteres.`;
  const vistas = new Set<string>();
  const repetidas = new Set<string>();
  for (const p of plaquetas) {
    const k = p.toLowerCase();
    if (vistas.has(k)) repetidas.add(p);
    vistas.add(k);
  }
  return repetidas.size > 0 ? `Plaquetas repetidas: ${[...repetidas].join(', ')}.` : null;
}
