import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { montarParams } from '../utils/http-params';
import { Aprovacao, AprovacaoDetalhe, DecidirAprovacao, StatusAprovacao } from '../models/aprovacao.model';

interface Pagina<T> { items: T[]; total: number; page: number; pageSize: number; }

/** Caixa de aprovações do Core (`v1/aprovacoes`). Stateless. */
@Injectable({ providedIn: 'root' })
export class AprovacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/aprovacoes`;

  listar(status?: StatusAprovacao | '', page = 1, pageSize = 50) {
    return this.http.get<Pagina<Aprovacao>>(this.url, { params: montarParams({ status, page, pageSize }) });
  }

  obter(id: number) {
    return this.http.get<AprovacaoDetalhe>(`${this.url}/${id}`);
  }

  decidir(id: number, req: DecidirAprovacao) {
    return this.http.post<AprovacaoDetalhe>(`${this.url}/${id}/decidir`, req);
  }
}
