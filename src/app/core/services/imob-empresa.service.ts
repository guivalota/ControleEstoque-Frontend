import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AtualizarImobEmpresa, CriarImobEmpresa, ImobEmpresa, ImobUsuarioEmpresa } from '../models/imob-empresa.model';
import { PagedResult } from '../models/paged-result.model';

/** Administração de empresas (somente admin). Não usa o header X-Empresa-Id. */
@Injectable({ providedIn: 'root' })
export class ImobEmpresaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/empresas`;

  listar(page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobEmpresa>>(this.url, { params });
  }

  criar(req: CriarImobEmpresa) {
    return this.http.post<ImobEmpresa>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobEmpresa) {
    return this.http.put<ImobEmpresa>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  usuarios(id: number) {
    return this.http.get<ImobUsuarioEmpresa[]>(`${this.url}/${id}/usuarios`);
  }

  vincular(id: number, usuarioId: string) {
    return this.http.post<void>(`${this.url}/${id}/usuarios`, { usuarioId });
  }

  desvincular(id: number, usuarioId: string) {
    return this.http.delete<void>(`${this.url}/${id}/usuarios/${usuarioId}`);
  }
}
