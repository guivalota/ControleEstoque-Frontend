import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CriarImobParametrosVersao, ImobParametrosVersao } from '../models/imob-reavaliacao.model';
import { PagedResult } from '../models/paged-result.model';

/** Pesos da reavaliação (EC, VF, VP e divisor): versões imutáveis, uma vigente por empresa. */
@Injectable({ providedIn: 'root' })
export class ImobReavaliacaoParametrosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/reavaliacao/parametros`;

  vigente() {
    return this.http.get<ImobParametrosVersao>(this.url);
  }

  obter(id: number) {
    return this.http.get<ImobParametrosVersao>(`${this.url}/${id}`);
  }

  historico(page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobParametrosVersao>>(`${this.url}/historico`, { params });
  }

  criarVersao(req: CriarImobParametrosVersao) {
    return this.http.post<ImobParametrosVersao>(this.url, req);
  }
}
