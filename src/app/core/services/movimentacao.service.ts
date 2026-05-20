import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Movimentacao, CreateMovimentacaoRequest, SaldoEstoque } from '../models/movimentacao.model';
import { ApiResult } from '../models/nota-fiscal.model';

export interface MovimentacaoFiltros {
  DataInicio?: string;
  DataFim?: string;
  CategoriaId?: number;
}

@Injectable({ providedIn: 'root' })
export class MovimentacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/movimentacoes`;

  movimentacoes = signal<Movimentacao[]>([]);
  loading = signal(false);

  getAll(filtros?: MovimentacaoFiltros) {
    this.loading.set(true);
    let params = new HttpParams();
    if (filtros?.DataInicio) params = params.set('DataInicio', filtros.DataInicio);
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);

    return this.http.get<ApiResult<Movimentacao>>(this.url, { params }).pipe(
      map(res => res.value ?? []),
      tap(data => {
        this.movimentacoes.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<Movimentacao>(`${this.url}/${id}`);
  }

  getByProduto(produtoId: number) {
    return this.http.get<Movimentacao[]>(`${this.url}/produto/${produtoId}`);
  }

  getSaldo(produtoId: number) {
    return this.http.get<SaldoEstoque>(`${this.url}/saldo/${produtoId}`);
  }

  create(req: CreateMovimentacaoRequest) {
    return this.http.post<Movimentacao>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }
}
