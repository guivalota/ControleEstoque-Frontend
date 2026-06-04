import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuditLog, AuditLogFiltros } from '../models/audit-log.model';

interface PagedResult<T> { items: T[]; page: number; pageSize: number; total: number; }

export interface AuditLogPage { items: AuditLog[]; total: number; }

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/audit-logs`;

  getAll(filtros?: AuditLogFiltros) {
    let params = new HttpParams();
    if (filtros?.usuarioId) params = params.set('usuarioId', filtros.usuarioId);
    if (filtros?.method)    params = params.set('method', filtros.method);
    if (filtros?.endpoint)  params = params.set('endpoint', filtros.endpoint);
    if (filtros?.dataInicio) params = params.set('dataInicio', filtros.dataInicio);
    if (filtros?.dataFim)   params = params.set('dataFim', filtros.dataFim);
    if (filtros?.page)      params = params.set('page', filtros.page);
    if (filtros?.pageSize)  params = params.set('pageSize', filtros.pageSize);

    return this.http.get<PagedResult<AuditLog>>(this.url, { params }).pipe(
      map(res => ({ items: res.items, total: res.total } as AuditLogPage))
    );
  }
}
