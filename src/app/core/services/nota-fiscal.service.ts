import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotaFiscal, CreateNotaFiscalRequest } from '../models/nota-fiscal.model';
import { Movimentacao } from '../models/movimentacao.model';

@Injectable({ providedIn: 'root' })
export class NotaFiscalService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/notas-fiscais`;

  notasFiscais = signal<NotaFiscal[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return this.http.get<NotaFiscal[]>(this.url).pipe(
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
      `${environment.apiUrl}/movimentacoes/nota-fiscal/${notaFiscalId}`
    );
  }

  create(req: CreateNotaFiscalRequest) {
    return this.http.post<NotaFiscal>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }
}
