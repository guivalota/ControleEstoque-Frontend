import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ConferenciaResult, GiroEstoqueFiltro, GiroEstoqueResponse, CurvaAbcFiltro, CurvaAbcResponse } from '../models/conferencia.model';

export interface ConferenciaFiltros {
  DataInicio?: string;
  DataFim?: string;
  IncluirConsumoInterno?: boolean;
}

export interface ConferenciaGeralFiltros {
  DataFim?: string;
  CategoriaId?: number;
  ApenasComSaldo?: boolean;
  AbaixoDoMinimo?: boolean;
  AbaixoDoPontoReposicao?: boolean;
  IncluirConsumoInterno?: boolean;
  Page?: number;
  PageSize?: number;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ConferenciaPage {
  items: ConferenciaResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ConferenciaService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/v1/conferencia`;

  conferir(produtoId: number, filtros?: ConferenciaFiltros) {
    let params = new HttpParams();
    if (filtros?.DataInicio) params = params.set('DataInicio', filtros.DataInicio);
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.IncluirConsumoInterno) params = params.set('IncluirConsumoInterno', 'true');
    return this.http.get<ConferenciaResult>(`${this.baseUrl}/${produtoId}`, { params });
  }

  getGeral(filtros?: ConferenciaGeralFiltros) {
    let params = new HttpParams();
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);
    if (filtros?.ApenasComSaldo != null) params = params.set('ApenasComSaldo', String(filtros.ApenasComSaldo));
    if (filtros?.AbaixoDoMinimo != null) params = params.set('AbaixoDoMinimo', String(filtros.AbaixoDoMinimo));
    if (filtros?.AbaixoDoPontoReposicao != null) params = params.set('AbaixoDoPontoReposicao', String(filtros.AbaixoDoPontoReposicao));
    if (filtros?.IncluirConsumoInterno) params = params.set('IncluirConsumoInterno', 'true');
    if (filtros?.Page != null) params = params.set('Page', filtros.Page);
    if (filtros?.PageSize != null) params = params.set('PageSize', filtros.PageSize);

    return this.http.get<PagedResult<ConferenciaResult>>(this.baseUrl, { params }).pipe(
      map(data => ({ items: data.items, total: data.total } as ConferenciaPage))
    );
  }

  exportarCsv(filtros?: ConferenciaGeralFiltros) {
    let params = new HttpParams().set('formato', 'csv');
    if (filtros?.DataFim) params = params.set('DataFim', filtros.DataFim);
    if (filtros?.CategoriaId) params = params.set('CategoriaId', filtros.CategoriaId);
    if (filtros?.ApenasComSaldo != null) params = params.set('ApenasComSaldo', String(filtros.ApenasComSaldo));
    if (filtros?.AbaixoDoMinimo != null) params = params.set('AbaixoDoMinimo', String(filtros.AbaixoDoMinimo));
    if (filtros?.AbaixoDoPontoReposicao != null) params = params.set('AbaixoDoPontoReposicao', String(filtros.AbaixoDoPontoReposicao));
    if (filtros?.IncluirConsumoInterno) params = params.set('IncluirConsumoInterno', 'true');

    return this.http.get(this.baseUrl, { params, responseType: 'blob' });
  }

  getGiroEstoque(filtro: GiroEstoqueFiltro = {}) {
    let params = new HttpParams();
    if (filtro.dataInicio) params = params.set('dataInicio', filtro.dataInicio);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    if (filtro.categoriaId != null) params = params.set('categoriaId', filtro.categoriaId);
    if (filtro.ordenacao) params = params.set('ordenacao', filtro.ordenacao);
    if (filtro.page != null) params = params.set('page', filtro.page);
    if (filtro.pageSize != null) params = params.set('pageSize', filtro.pageSize);
    return this.http.get<PagedResult<GiroEstoqueResponse>>(`${this.baseUrl}/giro-estoque`, { params });
  }

  exportarCsvGiro(filtro: GiroEstoqueFiltro = {}) {
    let params = new HttpParams().set('formato', 'csv');
    if (filtro.dataInicio) params = params.set('dataInicio', filtro.dataInicio);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    if (filtro.categoriaId != null) params = params.set('categoriaId', filtro.categoriaId);
    if (filtro.ordenacao) params = params.set('ordenacao', filtro.ordenacao);
    return this.http.get(`${this.baseUrl}/giro-estoque`, { params, responseType: 'blob' });
  }

  getCurvaAbc(filtro: CurvaAbcFiltro = {}) {
    let params = new HttpParams();
    if (filtro.dataInicio) params = params.set('dataInicio', filtro.dataInicio);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    if (filtro.categoriaId != null) params = params.set('categoriaId', filtro.categoriaId);
    if (filtro.classe) params = params.set('classe', filtro.classe);
    if (filtro.page != null) params = params.set('page', filtro.page);
    if (filtro.pageSize != null) params = params.set('pageSize', filtro.pageSize);
    return this.http.get<PagedResult<CurvaAbcResponse>>(`${this.baseUrl}/curva-abc`, { params });
  }

  exportarCsvAbc(filtro: CurvaAbcFiltro = {}) {
    let params = new HttpParams().set('formato', 'csv');
    if (filtro.dataInicio) params = params.set('dataInicio', filtro.dataInicio);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    if (filtro.categoriaId != null) params = params.set('categoriaId', filtro.categoriaId);
    if (filtro.classe) params = params.set('classe', filtro.classe);
    return this.http.get(`${this.baseUrl}/curva-abc`, { params, responseType: 'blob' });
  }

  getSugestoesReposicao(categoriaId?: number) {
    let params = new HttpParams();
    if (categoriaId != null) params = params.set('categoriaId', categoriaId);

    return this.http.get<PagedResult<ConferenciaResult>>(`${this.baseUrl}/sugestoes-reposicao`, { params }).pipe(
      map(data => data.items)
    );
  }
}
