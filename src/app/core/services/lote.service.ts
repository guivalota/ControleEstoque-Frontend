import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CreateLoteRequest, Lote, LoteFiltros, LotePage, UpdateLoteRequest } from '../models/lote.model';

interface PagedResult<T> { items: T[]; page: number; pageSize: number; total: number; }

@Injectable({ providedIn: 'root' })
export class LoteService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/lotes`;

  /** Paginado: o componente controla a página (params em PascalCase neste endpoint). */
  getAll(filtros: LoteFiltros = {}) {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null) params = params.set(chave, String(valor));
    }
    return this.http.get<PagedResult<Lote>>(this.url, { params }).pipe(
      map(r => ({ items: r.items, total: r.total } as LotePage))
    );
  }

  /** Lotes que vencem nos próximos `dias` dias (lista simples, sem paginação). */
  getVencendo(dias = 30) {
    return this.http.get<Lote[]>(`${this.url}/vencendo`, { params: new HttpParams().set('dias', dias) });
  }

  getById(id: number) {
    return this.http.get<Lote>(`${this.url}/${id}`);
  }

  create(req: CreateLoteRequest) {
    return this.http.post<Lote>(this.url, req);
  }

  update(id: number, req: UpdateLoteRequest) {
    return this.http.put<Lote>(`${this.url}/${id}`, req);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
