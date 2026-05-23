import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotaFiscal, CreateNotaFiscalRequest } from '../models/nota-fiscal.model';
import { Movimentacao } from '../models/movimentacao.model';

interface PagedResult<T> { items: T[]; total: number; }

@Injectable({ providedIn: 'root' })
export class NotaFiscalService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/notas-fiscais`;

  notasFiscais = signal<NotaFiscal[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    const params = new HttpParams().set('pageSize', 1000);
    return this.http.get<PagedResult<NotaFiscal>>(this.url, { params }).pipe(
      map(res => res.items),
      tap(data => {
        this.notasFiscais.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<NotaFiscal>(`${this.url}/${id}`);
  }

  getMovimentacoes(notaFiscalId: number) {
    return this.http.get<Movimentacao[]>(
      `${environment.apiUrl}/v1/movimentacoes/nota-fiscal/${notaFiscalId}`
    );
  }

  create(req: CreateNotaFiscalRequest) {
    return this.http.post<NotaFiscal>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }
}
