import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

/** Teto de `pageSize` aceito pelo back nas listas do Core/Estoque (`Math.Clamp(pageSize, 1, 100)`); acima disso o servidor corta em silêncio. */
export const PAGE_SIZE_MAX = 100;

interface Pagina<T> { items: T[]; total: number }

/**
 * Carrega todas as páginas de uma lista (PEND-043): `pageSize=1000` era reduzido a 100 pelo servidor e a lista
 * ficava truncada. Pede páginas de 100 até juntar `total` itens (ou vir uma página vazia).
 */
export function carregarTodasPaginas<T>(
  buscar: (page: number, pageSize: number) => Observable<Pagina<T>>
): Observable<T[]> {
  return buscar(1, PAGE_SIZE_MAX).pipe(
    map(res => ({ res, page: 1 })),
    expand(({ res, page }) => {
      const vistos = page * PAGE_SIZE_MAX;
      return res.items.length > 0 && res.items.length >= PAGE_SIZE_MAX && vistos < res.total
        ? buscar(page + 1, PAGE_SIZE_MAX).pipe(map(r => ({ res: r, page: page + 1 })))
        : EMPTY;
    }),
    reduce((acc, { res }) => acc.concat(res.items ?? []), [] as T[])
  );
}
