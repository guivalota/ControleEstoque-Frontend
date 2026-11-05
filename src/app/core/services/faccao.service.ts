import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs';
import { erroDeBlob } from '../utils/erro-blob';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { EnviarFaccaoRequest, Oficina, ReceberFaccaoRequest, Remessa, RetornoRegistrado } from '../models/faccao.model';

@Injectable({ providedIn: 'root' })
export class FaccaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao/faccao`;

  listar(page: number, pageSize: number, filtro: { status?: string; atrasadas?: boolean; ordemId?: number } = {}) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filtro.status) params = params.set('status', filtro.status);
    if (filtro.atrasadas) params = params.set('atrasadas', true);
    if (filtro.ordemId) params = params.set('ordemId', filtro.ordemId);
    return this.http.get<PagedResult<Remessa>>(`${this.base}/remessas`, { params });
  }

  obter(id: number) {
    return this.http.get<Remessa>(`${this.base}/remessas/${id}`);
  }

  oficinas() {
    return this.http.get<Oficina[]>(`${this.base}/oficinas`);
  }

  /** Baixa os aviamentos do estoque e registra as peças em poder do terceirizado (tudo ou nada). */
  enviar(req: EnviarFaccaoRequest) {
    return this.http.post<Remessa>(`${this.base}/remessas`, req);
  }

  /** Retorno parcial ou final; `encerrar` fecha a remessa e registra o que faltou como perda. */
  receber(id: number, req: ReceberFaccaoRequest) {
    return this.http.post<RetornoRegistrado>(`${this.base}/remessas/${id}/retornos`, req);
  }

  romaneio(id: number) {
    return this.http.get(`${this.base}/remessas/${id}/romaneio`, { responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }
}
