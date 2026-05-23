import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cliente, CreateClienteRequest, UpdateClienteRequest } from '../models/cliente.model';

interface PagedResult<T> { items: T[]; total: number; }

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/clientes`;

  clientes = signal<Cliente[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    const params = new HttpParams().set('pageSize', 1000);
    return this.http.get<PagedResult<Cliente>>(this.url, { params }).pipe(
      map(res => res.items),
      tap(data => {
        this.clientes.set(data);
        this.loading.set(false);
      })
    );
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
