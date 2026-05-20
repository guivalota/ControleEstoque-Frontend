import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Fornecedor, CreateFornecedorRequest, UpdateFornecedorRequest } from '../models/fornecedor.model';

@Injectable({ providedIn: 'root' })
export class FornecedorService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/fornecedores`;

  fornecedores = signal<Fornecedor[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return this.http.get<Fornecedor[]>(this.url).pipe(
      tap(data => {
        this.fornecedores.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<Fornecedor>(`${this.url}/${id}`);
  }

  consultarCnpj(cnpj: string) {
    return this.http.get<Fornecedor>(`${this.url}/consultar/${cnpj}`);
  }

  create(req: CreateFornecedorRequest) {
    return this.http.post<Fornecedor>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: number, req: UpdateFornecedorRequest) {
    return this.http.put<Fornecedor>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.fornecedores.update(list => list.filter(f => f.id !== id)))
    );
  }
}
