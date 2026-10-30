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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 4.500,00 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return BRL.format(valor);
}

/** yyyy-MM-dd (ou ISO completo) → dd/MM/yyyy, sem passar por Date (evita deslocamento de fuso). */
export function formatarData(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Instante ISO (UTC) → dd/MM/yyyy HH:mm no fuso do navegador. */
export function formatarDataHora(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d).replace(',', '');
}

const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

/** 12,5 — número com separador brasileiro e até 4 casas (pesos, notas, faixas); null/NaN vira "—". */
export function formatarNumero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? NUMERO.format(n) : String(valor);
}
