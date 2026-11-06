/** Datas e parcelas do Financeiro. As regras espelham o servidor (soma exata, vencimento mensal sem acumular desvio). */

/** Hoje no calendário do navegador, como `aaaa-mm-dd` (o servidor valida pela data de São Paulo). */
export function hojeIso(agora: Date = new Date()): string {
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mm}-${dd}`;
}

/** `aaaa-mm-dd` + N meses, mantendo o dia (ou o último dia do mês mais curto): 31/01 + 1 = 28/02. Sem passar por `Date` (sem fuso). */
export function somarMeses(iso: string, meses: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const indice = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  const ultimo = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Number(m[3]), ultimo);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Divide `total` em `n` parcelas em centavos: iguais, e a última absorve a diferença (a soma fecha exatamente no total). */
export function dividirParcelas(total: number, n: number): number[] {
  const centavos = Math.round(total * 100);
  if (n < 1 || centavos < n) return [];
  const base = Math.floor(centavos / n);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? base : centavos - base * (n - 1)) / 100);
}

/** Primeiro dia do mês de `aaaa-mm-dd`. */
export function primeiroDiaDoMes(iso: string): string { return iso.slice(0, 8) + '01'; }

/** Mês `aaaa-mm` do primeiro dia do mês corrente. */
export function mesAtual(agora: Date = new Date()): string { return hojeIso(agora).slice(0, 7); }

/** Último dia do mês `aaaa-mm` como `aaaa-mm-dd`. */
export function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
}
