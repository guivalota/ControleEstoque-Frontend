import { ImobResponsavel } from '../models/imob-responsavel.model';

/** "120 meses (10 anos)", "18 meses (1 ano e 6 meses)", "6 meses". */
export function formatarVidaUtil(meses: number | null | undefined): string {
  if (meses === null || meses === undefined || !Number.isFinite(meses)) return '';
  const rotuloMeses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
  if (meses < 12) return rotuloMeses(meses);
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const rotuloAnos = `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${rotuloMeses(meses)} (${resto ? `${rotuloAnos} e ${rotuloMeses(resto)}` : rotuloAnos})`;
}

/** `nome (matrícula)` para distinguir homônimos. */
export function rotuloResponsavel(r: Pick<ImobResponsavel, 'nome' | 'matricula'>): string {
  return r.matricula ? `${r.nome} (${r.matricula})` : r.nome;
}

/** 12,5% — separador decimal brasileiro sem depender do registro de locale do Angular. */
export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor) + '%';
}
