import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, from, map, switchMap, throwError, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImobBem, ImobBemFiltro, ImobBemHistorico, SalvarImobBem } from '../models/imob-bem.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

export interface ArquivoExportado {
  blob: Blob;
  nome: string;
}

/**
 * Com `responseType: 'blob'` o corpo do erro também chega como Blob; reconstrói o erro com o
 * JSON/texto original para que `lerErroApi` consiga ler a mensagem do servidor.
 */
function erroDeBlob(err: HttpErrorResponse): Observable<never> {
  if (!(err.error instanceof Blob)) return throwError(() => err);
  return from(err.error.text()).pipe(
    switchMap(texto => {
      let corpo: unknown = texto;
      try { corpo = JSON.parse(texto); } catch { /* texto puro */ }
      return throwError(() => new HttpErrorResponse({
        error: corpo, status: err.status, statusText: err.statusText, headers: err.headers, url: err.url ?? undefined
      }));
    })
  );
}

@Injectable({ providedIn: 'root' })
export class ImobBemService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/bens`;

  /** `incluirSublocais` só vai na query quando é `false` (o padrão do servidor é `true`). */
  private params(filtro: ImobBemFiltro): HttpParams {
    const { incluirSublocais, ...resto } = filtro;
    return montarParams({ ...resto, incluirSublocais: incluirSublocais === false ? false : undefined });
  }

  listar(filtro: ImobBemFiltro = {}) {
    return this.http.get<PagedResult<ImobBem>>(this.url, { params: this.params(filtro) });
  }

  obter(id: number) {
    return this.http.get<ImobBem>(`${this.url}/${id}`);
  }

  porPlaqueta(plaqueta: string) {
    return this.http.get<ImobBem>(`${this.url}/por-plaqueta`, { params: new HttpParams().set('plaqueta', plaqueta) });
  }

  /** Trilha de alterações, do mais recente para o mais antigo. */
  historico(id: number, page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobBemHistorico>>(`${this.url}/${id}/historico`, { params });
  }

  criar(req: SalvarImobBem) {
    return this.http.post<ImobBem>(this.url, req);
  }

  atualizar(id: number, req: SalvarImobBem) {
    return this.http.put<ImobBem>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** CSV com os mesmos filtros da listagem (sem paginação). Baixa via HttpClient por causa do X-Empresa-Id. */
  exportar(filtro: ImobBemFiltro = {}): Observable<ArquivoExportado> {
    const { page, pageSize, ...semPaginacao } = filtro;
    void page; void pageSize;
    return this.http.get(`${this.url}/exportar`, {
      params: this.params(semPaginacao), responseType: 'blob', observe: 'response'
    }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'bens.csv'
      })),
      catchError(erroDeBlob)
    );
  }
}
