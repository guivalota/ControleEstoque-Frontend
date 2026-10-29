/** Faixa em edição: campos podem estar vazios enquanto o usuário digita (`ate` vazio = sem limite). */
export interface FaixaEdicao {
  de: number | null;
  ate: number | null;
  nota: number | null;
}

export interface ResultadoValidacaoFaixas {
  /** Problemas da escala como um todo (lista vazia, limite de faixas). */
  geral: string[];
  /** Problemas por linha, na mesma ordem das faixas. */
  porLinha: string[][];
  valida: boolean;
}

export const MAX_FAIXAS = 100;

const ehNumero = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v);
const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(n);

/**
 * Valida faixas semiabertas [de, ate) com as mesmas regras do servidor: ao menos 1 faixa (máx. 100);
 * a primeira começa em 0; cada `de` é igual ao `ate` da anterior (sem lacuna nem sobreposição);
 * só a última tem `ate` vazio e ela é obrigatória; `ate` > `de`; nota de 0 a 10.
 */
export function validarFaixas(faixas: readonly FaixaEdicao[]): ResultadoValidacaoFaixas {
  const geral: string[] = [];
  const porLinha: string[][] = faixas.map(() => []);

  if (faixas.length === 0) geral.push('Inclua ao menos uma faixa.');
  if (faixas.length > MAX_FAIXAS) geral.push(`No máximo ${MAX_FAIXAS} faixas.`);

  faixas.forEach((f, i) => {
    const erros = porLinha[i];
    const ultima = i === faixas.length - 1;

    if (!ehNumero(f.de)) erros.push('Informe o início (de).');
    if (!ehNumero(f.nota)) erros.push('Informe a nota.');
    else if (f.nota < 0 || f.nota > 10) erros.push('A nota deve ficar entre 0 e 10.');

    if (i === 0 && ehNumero(f.de) && f.de !== 0) erros.push('A primeira faixa deve começar em 0.');

    if (i > 0 && ehNumero(f.de)) {
      const anterior = faixas[i - 1];
      if (ehNumero(anterior.ate)) {
        if (f.de > anterior.ate) erros.push(`Lacuna: a faixa anterior termina em ${fmt(anterior.ate)} e esta começa em ${fmt(f.de)}.`);
        else if (f.de < anterior.ate) erros.push(`Sobreposição: a faixa anterior termina em ${fmt(anterior.ate)} e esta começa em ${fmt(f.de)}.`);
      }
    }

    if (f.ate === null) {
      if (!ultima) erros.push('Só a última faixa pode ficar sem limite superior.');
    } else if (!ehNumero(f.ate)) {
      erros.push('Valor de término inválido.');
    } else {
      if (ehNumero(f.de) && f.ate <= f.de) erros.push('O término deve ser maior que o início.');
      if (ultima) erros.push('A última faixa deve ficar sem limite superior (término vazio).');
    }
  });

  return { geral, porLinha, valida: geral.length === 0 && porLinha.every(e => e.length === 0) };
}

/** Nota da faixa que contém o valor (negativo conta como 0); null se nenhuma contém. */
export function notaDaEscala(faixas: readonly FaixaEdicao[], valor: number): number | null {
  const v = Math.max(0, valor);
  for (const f of faixas) {
    if (ehNumero(f.de) && v >= f.de && (f.ate === null || (ehNumero(f.ate) && v < f.ate))) {
      return ehNumero(f.nota) ? f.nota : null;
    }
  }
  return null;
}
