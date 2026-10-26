import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Formata 14 dígitos como 00.000.000/0000-00; devolve o valor original se não tiver 14 dígitos. */
export function formatarCnpj(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (digitos.length !== 14) return valor ?? '';
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Máscara progressiva para digitação: aplica a pontuação conforme os dígitos chegam (máx. 14). */
export function mascararCnpj(valor: string | null | undefined): string {
  const d = (valor ?? '').replace(/\D/g, '').slice(0, 14);
  let r = d.slice(0, 2);
  if (d.length > 2) r += '.' + d.slice(2, 5);
  if (d.length > 5) r += '.' + d.slice(5, 8);
  if (d.length > 8) r += '/' + d.slice(8, 12);
  if (d.length > 12) r += '-' + d.slice(12, 14);
  return r;
}

function digitoVerificador(base: string): number {
  let peso = base.length - 7;
  let soma = 0;
  for (const c of base) {
    soma += Number(c) * peso--;
    if (peso < 2) peso = 9;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida 14 dígitos e os dois dígitos verificadores (o servidor sempre revalida). */
export function cnpjValido(valor: string | null | undefined): boolean {
  const d = (valor ?? '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const d1 = digitoVerificador(d.slice(0, 12));
  const d2 = digitoVerificador(d.slice(0, 12) + d1);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** Validador de formulário: vazio passa (use `required` junto). */
export function cnpjValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string | null;
  if (!v) return null;
  return cnpjValido(v) ? null : { cnpj: true };
}
