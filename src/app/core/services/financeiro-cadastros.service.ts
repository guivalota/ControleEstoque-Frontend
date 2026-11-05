import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { carregarTodasPaginas } from '../utils/paginas';
import {
  AtualizarCategoriaFin, AtualizarCentroCustoFin, AtualizarContaFin, CategoriaFin, CentroCustoFin, ContaFin,
  CriarCategoriaFin, CriarCentroCustoFin, CriarContaFin
} from '../models/financeiro-cadastros.model';

interface Pagina<T> { items: T[]; total: number; }

/** Contas, categorias e centros de custo do Financeiro. Escrita exige `financeiro.cadastros.editar`. */
@Injectable({ providedIn: 'root' })
export class FinanceiroCadastrosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/financeiro`;

  private todas<T>(rota: string): Observable<T[]> {
    return carregarTodasPaginas<T>((page, pageSize) =>
      this.http.get<Pagina<T>>(`${this.base}/${rota}`, { params: new HttpParams().set('page', page).set('pageSize', pageSize) }));
  }

  // Contas
  contas() { return this.todas<ContaFin>('contas'); }
  criarConta(req: CriarContaFin) { return this.http.post<ContaFin>(`${this.base}/contas`, req); }
  atualizarConta(id: number, req: AtualizarContaFin) { return this.http.put<ContaFin>(`${this.base}/contas/${id}`, req); }
  excluirConta(id: number) { return this.http.delete<void>(`${this.base}/contas/${id}`); }

  // Categorias
  categorias() { return this.todas<CategoriaFin>('categorias'); }
  criarCategoria(req: CriarCategoriaFin) { return this.http.post<CategoriaFin>(`${this.base}/categorias`, req); }
  atualizarCategoria(id: number, req: AtualizarCategoriaFin) { return this.http.put<CategoriaFin>(`${this.base}/categorias/${id}`, req); }
  excluirCategoria(id: number) { return this.http.delete<void>(`${this.base}/categorias/${id}`); }

  // Centros de custo
  centros() { return this.todas<CentroCustoFin>('centros-custo'); }
  criarCentro(req: CriarCentroCustoFin) { return this.http.post<CentroCustoFin>(`${this.base}/centros-custo`, req); }
  atualizarCentro(id: number, req: AtualizarCentroCustoFin) { return this.http.put<CentroCustoFin>(`${this.base}/centros-custo/${id}`, req); }
  excluirCentro(id: number) { return this.http.delete<void>(`${this.base}/centros-custo/${id}`); }
}
