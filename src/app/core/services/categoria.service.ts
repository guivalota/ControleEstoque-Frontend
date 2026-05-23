import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Categoria, CreateCategoriaRequest, UpdateCategoriaRequest } from '../models/categoria.model';

interface PagedResult<T> { items: T[]; total: number; }

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/categorias`;

  categorias = signal<Categoria[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    const params = new HttpParams().set('pageSize', 1000);
    return this.http.get<PagedResult<Categoria>>(this.url, { params }).pipe(
      map(res => res.items),
      tap(data => {
        this.categorias.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<Categoria>(`${this.url}/${id}`);
  }

  create(req: CreateCategoriaRequest) {
    return this.http.post<Categoria>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: number, req: UpdateCategoriaRequest) {
    return this.http.put<Categoria>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.categorias.update(list => list.filter(c => c.id !== id)))
    );
  }
}
