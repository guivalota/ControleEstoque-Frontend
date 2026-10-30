import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { carregarTodasPaginas } from '../utils/paginas';
import { Cliente, CreateClienteRequest, UpdateClienteRequest } from '../models/cliente.model';

interface PagedResult<T> { items: T[]; total: number; }

export interface ClienteFiltros {
  busca?: string;
  uf?: string;
  ativo?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/clientes`;

  clientes = signal<Cliente[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return carregarTodasPaginas<Cliente>((page, pageSize) =>
      this.http.get<PagedResult<Cliente>>(this.url, { params: new HttpParams().set('page', page).set('pageSize', pageSize) })
    ).pipe(
      tap(data => {
        this.clientes.set(data);
        this.loading.set(false);
      })
    );
  }

  buscar(filtros: ClienteFiltros) {
    let params = new HttpParams();
    if (filtros.busca)         params = params.set('busca', filtros.busca);
    if (filtros.uf)            params = params.set('uf', filtros.uf);
    if (filtros.ativo != null) params = params.set('ativo', String(filtros.ativo));
    if (filtros.page)          params = params.set('page', filtros.page);
    if (filtros.pageSize)      params = params.set('pageSize', filtros.pageSize);
    return this.http.get<PagedResult<Cliente>>(this.url, { params });
  }

  getById(id: number) {
    return this.http.get<Cliente>(`${this.url}/${id}`);
  }

  create(req: CreateClienteRequest) {
    return this.http.post<Cliente>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: number, req: UpdateClienteRequest) {
    return this.http.put<Cliente>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clientes.update(list => list.filter(c => c.id !== id)))
    );
  }
}
