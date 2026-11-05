import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { CreateFichaTecnicaRequest, FichaConsumo, FichaCusto, FichaTecnica } from '../models/ficha-tecnica.model';

@Injectable({ providedIn: 'root' })
export class FichaTecnicaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao`;

  listar(page: number, pageSize: number, busca?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (busca) params = params.set('busca', busca);
    return this.http.get<PagedResult<FichaTecnica>>(`${this.base}/fichas-tecnicas`, { params });
  }

  obter(id: number) {
    return this.http.get<FichaTecnica>(`${this.base}/fichas-tecnicas/${id}`);
  }

  vigente(produtoId: number) {
    return this.http.get<FichaTecnica>(`${this.base}/produtos/${produtoId}/ficha-tecnica`);
  }

  versoes(produtoId: number) {
    return this.http.get<FichaTecnica[]>(`${this.base}/produtos/${produtoId}/fichas-tecnicas`);
  }

  consumo(fichaId: number, variacaoId?: number | null) {
    let params = new HttpParams();
    if (variacaoId) params = params.set('variacaoId', variacaoId);
    return this.http.get<FichaConsumo[]>(`${this.base}/fichas-tecnicas/${fichaId}/consumo`, { params });
  }

  custo(fichaId: number, variacaoId?: number | null) {
    let params = new HttpParams();
    if (variacaoId) params = params.set('variacaoId', variacaoId);
    return this.http.get<FichaCusto>(`${this.base}/fichas-tecnicas/${fichaId}/custo`, { params });
  }

  /** Cria a ficha ou, se o produto já tem, a próxima versão (que passa a ser a vigente). */
  salvar(req: CreateFichaTecnicaRequest) {
    return this.http.post<FichaTecnica>(`${this.base}/fichas-tecnicas`, req);
  }
}
