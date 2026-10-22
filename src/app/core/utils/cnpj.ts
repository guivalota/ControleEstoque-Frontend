/** Formata 14 dígitos como 00.000.000/0000-00; devolve o valor original se não tiver 14 dígitos. */
export function formatarCnpj(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (digitos.length !== 14) return valor ?? '';
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
