import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Produto, CreateProdutoRequest, UpdateProdutoRequest } from '../models/produto.model';

@Injectable({ providedIn: 'root' })
export class ProdutoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/produtos`;

  produtos = signal<Produto[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return this.http.get<Produto[]>(this.url).pipe(
      tap(data => {
        this.produtos.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<Produto>(`${this.url}/${id}`);
  }

  create(req: CreateProdutoRequest) {
    return this.http.post<Produto>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: number, req: UpdateProdutoRequest) {
    return this.http.put<Produto>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.produtos.update(list => list.filter(p => p.id !== id)))
    );
  }
}
