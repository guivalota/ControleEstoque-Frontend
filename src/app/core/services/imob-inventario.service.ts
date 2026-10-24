import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ImobInventario, ImobInventarioFiltro, ImobInventarioResumo, SalvarImobInventario
} from '../models/imob-inventario.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';
import { erroDeBlob } from '../utils/erro-blob';
import { ArquivoExportado } from './imob-bem.service';

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

  /** Admin. Com pendências, o servidor recusa (400) a menos que `confirmarPendencias` seja true. */
  encerrar(id: number, confirmarPendencias = false) {
    return this.http.post<ImobInventario>(`${this.url}/${id}/encerrar`, { confirmarPendencias });
  }

  /** PDF ou CSV (parcial quando não concluído). Baixa via HttpClient por causa do X-Empresa-Id. */
  relatorio(id: number, formato: 'pdf' | 'csv'): Observable<ArquivoExportado> {
    return this.http.get(`${this.url}/${id}/relatorio`, {
      params: montarParams({ formato }), responseType: 'blob', observe: 'response'
    }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
          ?? `inventario-${id}.${formato}`
      })),
      catchError(erroDeBlob)
    );
  }
}
