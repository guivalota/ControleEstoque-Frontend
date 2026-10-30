import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Remove pontuação/espaços e põe em maiúsculas (CNPJ numérico ou alfanumérico). Não valida. */
export function normalizarCnpj(valor: string | null | undefined): string {
  return (valor ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** Formata 14 caracteres como 00.000.000/0000-00 (aceita letras); devolve o valor original se não tiver 14. */
export function formatarCnpj(valor: string | null | undefined): string {
  const n = normalizarCnpj(valor);
  if (n.length !== 14) return valor ?? '';
  return n.replace(/^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})([0-9A-Z]{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Máscara progressiva para digitação (máx. 14): 12 primeiras posições aceitam letras e dígitos
 * (maiúsculas); as 2 últimas (dígitos verificadores) só aceitam dígitos.
 */
export function mascararCnpj(valor: string | null | undefined): string {
  const n = normalizarCnpj(valor);
  const d = n.slice(0, 12) + n.slice(12).replace(/\D/g, '').slice(0, 2);
  let r = d.slice(0, 2);
  if (d.length > 2) r += '.' + d.slice(2, 5);
  if (d.length > 5) r += '.' + d.slice(5, 8);
  if (d.length > 8) r += '/' + d.slice(8, 12);
  if (d.length > 12) r += '-' + d.slice(12, 14);
  return r;
}

/** Valor de cada caractere no cálculo: código ASCII - 48 ('0'=0 … '9'=9, 'A'=17 … 'Z'=42). */
function valorCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

function digitoVerificador(base: string): number {
  let peso = base.length - 7;
  let soma = 0;
  for (const c of base) {
    soma += valorCaractere(c) * peso--;
    if (peso < 2) peso = 9;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CNPJ numérico ou alfanumérico (2026): 12 posições [0-9A-Z] + 2 dígitos verificadores numéricos
 * (módulo 11, mesmos pesos; espelha `CnpjAlfanumerico` do servidor, que sempre revalida).
 */
export function cnpjValido(valor: string | null | undefined): boolean {
  const n = normalizarCnpj(valor);
  if (n.length !== 14 || !/^[0-9A-Z]{12}\d{2}$/.test(n) || /^(.)\1+$/.test(n)) return false;
  const d1 = digitoVerificador(n.slice(0, 12));
  const d2 = digitoVerificador(n.slice(0, 12) + d1);
  return d1 === Number(n[12]) && d2 === Number(n[13]);
}

/** Validador de formulário: vazio passa (use `required` junto). */
export function cnpjValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string | null;
  if (!v) return null;
  return cnpjValido(v) ? null : { cnpj: true };
}
