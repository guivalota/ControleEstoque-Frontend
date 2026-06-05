import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  PedidoCompra, PedidoCompraFiltros,
  CreatePedidoCompraRequest, UpdatePedidoCompraRequest, AddPedidoItemRequest
} from '../models/pedido-compra.model';

interface PagedResult<T> { items: T[]; page: number; pageSize: number; total: number; }
export interface PedidoCompraPage { items: PedidoCompra[]; total: number; }

@Injectable({ providedIn: 'root' })
export class PedidoCompraService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/pedidos-compra`;

  getAll(filtros?: PedidoCompraFiltros) {
    let params = new HttpParams();
    if (filtros?.status)     params = params.set('status', filtros.status);
    if (filtros?.criadoPor)  params = params.set('criadoPor', filtros.criadoPor);
    if (filtros?.destinadoA) params = params.set('destinadoA', filtros.destinadoA);
    if (filtros?.page)       params = params.set('page', filtros.page);
    if (filtros?.pageSize)   params = params.set('pageSize', filtros.pageSize);
    return this.http.get<PagedResult<PedidoCompra>>(this.url, { params }).pipe(
      map(res => ({ items: res.items, total: res.total } as PedidoCompraPage))
    );
  }

  getAbertos() {
    return this.getAll({ status: 'aberto', pageSize: 1000 });
  }

  getById(id: number) {
    return this.http.get<PedidoCompra>(`${this.url}/${id}`);
  }

  create(req: CreatePedidoCompraRequest) {
    return this.http.post<PedidoCompra>(this.url, req);
  }

  update(id: number, req: UpdatePedidoCompraRequest) {
    return this.http.put<PedidoCompra>(`${this.url}/${id}`, req);
  }

  cancel(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  addItem(pedidoId: number, req: AddPedidoItemRequest) {
    return this.http.post<PedidoCompra>(`${this.url}/${pedidoId}/itens`, req);
  }

  removeItem(pedidoId: number, itemId: number) {
    return this.http.delete<void>(`${this.url}/${pedidoId}/itens/${itemId}`);
  }
}
