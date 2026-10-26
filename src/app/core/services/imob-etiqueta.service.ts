import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImobEtiquetaModelo, ImobEtiquetaPedido } from '../models/imob-etiqueta.model';
import { erroDeBlob } from '../utils/erro-blob';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobEtiquetaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/etiquetas`;

  modelos() {
    return this.http.get<ImobEtiquetaModelo[]>(`${this.url}/modelos`);
  }

  /**
   * PDF das etiquetas como Blob (o `X-Empresa-Id` não vai em link direto). Com `ids` os filtros
   * são ignorados; sem `ids` vão os filtros da listagem, sem paginação.
   */
  gerar(pedido: ImobEtiquetaPedido): Observable<Blob> {
    let params = montarParams({ modelo: pedido.modelo, bordas: pedido.bordas ? true : undefined });
    if (pedido.ids?.length) {
      for (const id of pedido.ids) params = params.append('ids', id);
    } else if (pedido.filtro) {
      const { page, pageSize, incluirSublocais, ...resto } = pedido.filtro;
      void page; void pageSize;
      const filtro = montarParams({ ...resto, incluirSublocais: incluirSublocais === false ? false : undefined });
      for (const k of filtro.keys()) params = params.set(k, filtro.get(k) as string);
    }
    return this.http.get(this.url, { params, responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }
}
