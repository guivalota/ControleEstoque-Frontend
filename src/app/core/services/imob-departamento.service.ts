import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AtualizarImobDepartamento, CriarImobDepartamento, ImobDepartamento, ImobDepartamentoFiltro
} from '../models/imob-departamento.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobDepartamentoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/departamentos`;

  listar(filtro: ImobDepartamentoFiltro = {}) {
    return this.http.get<PagedResult<ImobDepartamento>>(this.url, { params: montarParams(filtro) });
  }

  criar(req: CriarImobDepartamento) {
    return this.http.post<ImobDepartamento>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobDepartamento) {
    return this.http.put<ImobDepartamento>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
