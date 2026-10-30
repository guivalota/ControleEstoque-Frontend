import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AtualizarImobCategoria, CriarImobCategoria, ImobCategoria, ImobCategoriaFiltro, ImobCategoriasPadraoResultado } from '../models/imob-categoria.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobCategoriaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/categorias`;

  listar(filtro: ImobCategoriaFiltro = {}) {
    return this.http.get<PagedResult<ImobCategoria>>(this.url, { params: montarParams(filtro) });
  }

  criar(req: CriarImobCategoria) {
    return this.http.post<ImobCategoria>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobCategoria) {
    return this.http.put<ImobCategoria>(`${this.url}/${id}`, req);
  }

  /** Só admin; idempotente: cria apenas as categorias padrão que faltam. */
  carregarPadrao() {
    return this.http.post<ImobCategoriasPadraoResultado>(`${this.url}/padrao`, {});
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
