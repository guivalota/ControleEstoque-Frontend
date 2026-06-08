import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Movimentacao, CreateMovimentacaoRequest, UpdateMovimentacaoRequest, SaldoEstoque, PrecoMedioMensal } from '../models/movimentacao.model';

export interface MovimentacaoFiltros {
  DataInicio?: string;
  DataFim?: string;
  CategoriaId?: number;
  ProdutoId?: number;
  Page?: number;
  PageSize?: number;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MovimentacaoPage {
  items: Movimentacao[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class MovimentacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/movimentacoes`;

  movimentacoes = signal<Movimentacao[]>([]);
  loading = signal(false);

  getAll(filtros?: MovimentacaoFiltros) {
    this.loading.set(true);
    let params = new HttpParams();
    if (filtros?.DataInicio) params = params.set('DataInicio', filtros.DataInicio);
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);
    if (filtros?.ProdutoId) params = params.set('ProdutoId', filtros.ProdutoId);
    if (filtros?.Page != null) params = params.set('Page', filtros.Page);
    if (filtros?.PageSize != null) params = params.set('PageSize', filtros.PageSize);

    return this.http.get<PagedResult<Movimentacao>>(this.url, { params }).pipe(
      map(data => ({ items: data.items, total: data.total } as MovimentacaoPage)),
      tap(({ items }) => {
        this.movimentacoes.set(items);
        this.loading.set(false);
      })
    );
  }

  exportarCsv(filtros?: MovimentacaoFiltros) {
    let params = new HttpParams().set('formato', 'csv');
    if (filtros?.DataInicio) params = params.set('DataInicio', filtros.DataInicio);
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);
    if (filtros?.ProdutoId) params = params.set('ProdutoId', filtros.ProdutoId);

    return this.http.get(this.url, { params, responseType: 'blob' });
  }

  getById(id: number) {
    return this.http.get<Movimentacao>(`${this.url}/${id}`);
  }

  getHistoricoPreco(produtoId: number, meses = 12) {
    const params = new HttpParams().set('meses', meses);
    return this.http.get<PrecoMedioMensal[]>(`${this.url}/historico-preco/${produtoId}`, { params });
  }

  getByProduto(produtoId: number) {
    return this.http.get<Movimentacao[]>(`${this.url}/produto/${produtoId}`);
  }

  getSaldo(produtoId: number) {
    return this.http.get<SaldoEstoque>(`${this.url}/saldo/${produtoId}`);
  }

  create(req: CreateMovimentacaoRequest) {
    return this.http.post<Movimentacao>(this.url, req);
  }

  update(id: number, req: UpdateMovimentacaoRequest) {
    return this.http.put<Movimentacao>(`${this.url}/${id}`, req);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.movimentacoes.update(list => list.filter(m => m.id !== id)))
    );
  }
}
