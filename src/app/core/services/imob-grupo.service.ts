import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AtualizarImobGrupo, CriarImobGrupo, ImobGrupo, ImobGrupoFiltro
} from '../models/imob-grupo.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobGrupoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/grupos`;

  listar(filtro: ImobGrupoFiltro = {}) {
    return this.http.get<PagedResult<ImobGrupo>>(this.url, { params: montarParams(filtro) });
  }

  criar(req: CriarImobGrupo) {
    return this.http.post<ImobGrupo>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobGrupo) {
    return this.http.put<ImobGrupo>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
