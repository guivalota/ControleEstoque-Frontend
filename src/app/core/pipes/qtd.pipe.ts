import { Pipe, PipeTransform } from '@angular/core';

/**
 * Quantidade do Estoque em pt-BR, com até 3 casas e sem zeros à direita: 12 -> "12", 12.35 -> "12,35".
 * O saldo é decimal (metro, quilo); `{{ x }}` mostraria ponto e zeros desnecessários.
 */
@Pipe({ name: 'qtd', standalone: true })
export class QtdPipe implements PipeTransform {
  transform(valor: number | string | null | undefined): string {
    return formatarQuantidade(valor);
  }
}

const formato = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export function formatarQuantidade(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return Number.isFinite(n) ? formato.format(n) : '';
}

/** `step` do input numérico para uma unidade: 0 casas = 1; 1 casa = 0.1; 3 casas = 0.001. Sem unidade conhecida aceita qualquer valor. */
export function stepDaUnidade(casas: number | null | undefined): string {
  if (casas === null || casas === undefined) return 'any';
  return casas <= 0 ? '1' : (1 / Math.pow(10, Math.min(casas, 3))).toString();
}
