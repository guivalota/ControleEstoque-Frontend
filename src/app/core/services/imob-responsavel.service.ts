import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AtualizarImobResponsavel, CriarImobResponsavel, ImobResponsavel, ImobResponsavelFiltro } from '../models/imob-responsavel.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobResponsavelService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/responsaveis`;

  listar(filtro: ImobResponsavelFiltro = {}) {
    return this.http.get<PagedResult<ImobResponsavel>>(this.url, { params: montarParams(filtro) });
  }

  obter(id: number) {
    return this.http.get<ImobResponsavel>(`${this.url}/${id}`);
  }

  criar(req: CriarImobResponsavel) {
    return this.http.post<ImobResponsavel>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobResponsavel) {
    return this.http.put<ImobResponsavel>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
