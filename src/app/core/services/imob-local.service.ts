import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AtualizarImobLocal, CriarImobLocal, ImobLocal, ImobLocalArvore } from '../models/imob-local.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

export interface ImobLocalFiltro {
  busca?: string; localPaiId?: number; apenasRaiz?: boolean; ativo?: boolean; page?: number; pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ImobLocalService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/locais`;

  arvore() {
    return this.http.get<ImobLocalArvore[]>(`${this.url}/arvore`);
  }

  listar(filtro: ImobLocalFiltro = {}) {
    return this.http.get<PagedResult<ImobLocal>>(this.url, { params: montarParams(filtro) });
  }

  criar(req: CriarImobLocal) {
    return this.http.post<ImobLocal>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobLocal) {
    return this.http.put<ImobLocal>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
