import { HttpParams } from '@angular/common/http';

/** Monta HttpParams só com os filtros definidos (ignora undefined, null e string vazia). */
export function montarParams(filtro: object): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') params = params.set(chave, String(valor));
  }
  return params;
}
