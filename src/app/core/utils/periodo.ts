/**
 * Filtros de data da Trilha, Auditoria e Logs (PEND-16 do DSG-21): o servidor compara em UTC, mas as tabelas
 * mostram a hora local. Por isso o front envia instantes ISO calculados no fuso do navegador.
 */

function partes(dia: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** `yyyy-MM-dd` (campo date) -> início desse dia no fuso do navegador, como ISO UTC. Vazio/inválido -> undefined. */
export function inicioDoDiaLocalISO(dia: string | null | undefined): string | undefined {
  const p = dia ? partes(dia) : null;
  return p ? new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0).toISOString() : undefined;
}

/** `yyyy-MM-dd` -> fim desse dia (23:59:59.999 local) como ISO UTC; a hora explícita faz o servidor respeitar o limite. */
export function fimDoDiaLocalISO(dia: string | null | undefined): string | undefined {
  const p = dia ? partes(dia) : null;
  return p ? new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).toISOString() : undefined;
}

/** Data fim anterior à data início (ambas preenchidas). */
export function intervaloInvertido(inicio: string | null | undefined, fim: string | null | undefined): boolean {
  return !!inicio && !!fim && fim < inicio;
}

export const AVISO_INTERVALO_INVERTIDO = 'A data fim é anterior à data início: ajuste o período.';
