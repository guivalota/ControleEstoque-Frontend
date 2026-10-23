import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ImobInventario, ImobInventarioFiltro, ImobInventarioResumo, SalvarImobInventario
} from '../models/imob-inventario.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobInventarioService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/inventarios`;

  listar(filtro: ImobInventarioFiltro = {}) {
    return this.http.get<PagedResult<ImobInventarioResumo>>(this.url, { params: montarParams(filtro) });
  }

  obter(id: number) {
    return this.http.get<ImobInventario>(`${this.url}/${id}`);
  }

  criar(req: SalvarImobInventario) {
    return this.http.post<ImobInventario>(this.url, req);
  }

  atualizar(id: number, req: SalvarImobInventario) {
    return this.http.put<ImobInventario>(`${this.url}/${id}`, req);
  }

  /** Congela o esperado e passa para `em_andamento`. */
  iniciar(id: number) {
    return this.http.post<ImobInventario>(`${this.url}/${id}/iniciar`, null);
  }

  cancelar(id: number) {
    return this.http.post<ImobInventario>(`${this.url}/${id}/cancelar`, null);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
