import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Impressao, ImpressaoFiltros } from '../models/impressao.model';

interface PagedResult<T> { items: T[]; page: number; pageSize: number; total: number; }
export interface ImpressaoPage { items: Impressao[]; total: number; }

@Injectable({ providedIn: 'root' })
export class ImpressaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/impressoes`;

  imprimirPedido(id: number) {
    return this.http.get(`${this.base}/pedido-compra/${id}`, { responseType: 'blob' });
  }

  abrirPdf(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  getHistorico(filtros?: ImpressaoFiltros) {
    let params = new HttpParams();
    if (filtros?.tipoDocumento) params = params.set('tipoDocumento', filtros.tipoDocumento);
    if (filtros?.documentoId)   params = params.set('documentoId', filtros.documentoId);
    if (filtros?.usuarioId)     params = params.set('usuarioId', filtros.usuarioId);
    if (filtros?.dataInicio)    params = params.set('dataInicio', filtros.dataInicio);
    if (filtros?.dataFim)       params = params.set('dataFim', filtros.dataFim);
    if (filtros?.page)          params = params.set('page', filtros.page);
    if (filtros?.pageSize)      params = params.set('pageSize', filtros.pageSize);
    return this.http.get<PagedResult<Impressao>>(this.base, { params }).pipe(
      map(res => ({ items: res.items, total: res.total } as ImpressaoPage))
    );
  }
}
