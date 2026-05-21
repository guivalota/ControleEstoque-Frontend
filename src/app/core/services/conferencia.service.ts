import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ConferenciaResult } from '../models/conferencia.model';

export interface ConferenciaFiltros {
  DataInicio?: string;
  DataFim?: string;
}

export interface ConferenciaGeralFiltros {
  DataFim?: string;
  CategoriaId?: number;
  ApenasComSaldo?: boolean;
  AbaixoDoMinimo?: boolean;
  Page?: number;
  PageSize?: number;
}

interface PaginadoResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ConferenciaPage {
  items: ConferenciaResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ConferenciaService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/conferencia`;

  conferir(produtoId: number, filtros?: ConferenciaFiltros) {
    let params = new HttpParams();
    if (filtros?.DataInicio) params = params.set('DataInicio', filtros.DataInicio);
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    return this.http.get<ConferenciaResult>(`${this.baseUrl}/${produtoId}`, { params });
  }

  getGeral(filtros?: ConferenciaGeralFiltros) {
    let params = new HttpParams();
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);
    if (filtros?.ApenasComSaldo != null) params = params.set('ApenasComSaldo', String(filtros.ApenasComSaldo));
    if (filtros?.AbaixoDoMinimo != null) params = params.set('AbaixoDoMinimo', String(filtros.AbaixoDoMinimo));
    if (filtros?.Page != null) params = params.set('Page', filtros.Page);
    if (filtros?.PageSize != null) params = params.set('PageSize', filtros.PageSize);

    return this.http.get<ConferenciaResult[] | PaginadoResponse<ConferenciaResult>>(this.baseUrl, { params }).pipe(
      map(data => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        const total = Array.isArray(data) ? data.length : data.total ?? 0;
        return { items, total } as ConferenciaPage;
      })
    );
  }
}
