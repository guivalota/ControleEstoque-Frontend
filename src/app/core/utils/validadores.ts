import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Aceita no máximo 2 casas decimais. */
export function duasCasas(c: AbstractControl): ValidationErrors | null {
  const v = c.value;
  if (v === null || v === '' || typeof v !== 'number') return null;
  return Math.abs(Math.round(v * 100) - v * 100) < 1e-6 ? null : { casas: true };
}

export function inteiro(c: AbstractControl): ValidationErrors | null {
  const v = c.value;
  return v === null || v === '' || Number.isInteger(v) ? null : { inteiro: true };
}

/** Hoje no fuso local, como yyyy-MM-dd. */
export function hojeIso(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Data yyyy-MM-dd entre 01/01/1900 e hoje (vazio passa; use `required` junto). */
export function dataAquisicaoValida(c: AbstractControl): ValidationErrors | null {
  const v = c.value as string | null;
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return { data: true };
  if (v < '1900-01-01') return { dataMinima: true };
  if (v > hojeIso()) return { dataFutura: true };
  return null;
}
