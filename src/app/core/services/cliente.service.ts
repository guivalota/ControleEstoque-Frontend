import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cliente, CreateClienteRequest, UpdateClienteRequest } from '../models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/clientes`;

  clientes = signal<Cliente[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return this.http.get<Cliente[]>(this.url).pipe(
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
