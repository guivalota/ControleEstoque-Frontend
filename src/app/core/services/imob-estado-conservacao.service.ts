import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AtualizarImobEstadoConservacao, CriarImobEstadoConservacao, ImobEstadoConservacao, ImobEstadoConservacaoFiltro,
  ImobEstadoConservacaoHistorico, ImobEstadosPadraoResultado
} from '../models/imob-reavaliacao.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobEstadoConservacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/estados-conservacao`;

  listar(filtro: ImobEstadoConservacaoFiltro = {}) {
    return this.http.get<PagedResult<ImobEstadoConservacao>>(this.url, { params: montarParams(filtro) });
  }

  criar(req: CriarImobEstadoConservacao) {
    return this.http.post<ImobEstadoConservacao>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobEstadoConservacao) {
    return this.http.put<ImobEstadoConservacao>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Idempotente: cria só os estados padrão que faltam (Excelente 10/10, Bom 8/8, Razoável 5/5, Ruim 2/2). */
  carregarPadrao() {
    return this.http.post<ImobEstadosPadraoResultado>(`${this.url}/padrao`, {});
  }

  /** Trilha de alterações, da mais recente para a mais antiga. */
  historico(id: number, page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobEstadoConservacaoHistorico>>(`${this.url}/${id}/historico`, { params });
  }
}
