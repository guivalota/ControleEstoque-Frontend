import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ConciliacaoFiltro, ConciliacaoItem, ConciliacaoResumo, PainelInventario, ResolverConciliacao
} from '../models/imob-conciliacao.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobConciliacaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/imobilizado/inventarios`;

  resumo(inventarioId: number) {
    return this.http.get<ConciliacaoResumo>(`${this.base}/${inventarioId}/conciliacao/resumo`);
  }

  listar(inventarioId: number, filtro: ConciliacaoFiltro = {}) {
    return this.http.get<PagedResult<ConciliacaoItem>>(`${this.base}/${inventarioId}/conciliacao`, { params: montarParams(filtro) });
  }

  resolver(inventarioId: number, req: ResolverConciliacao) {
    return this.http.post<ConciliacaoItem>(`${this.base}/${inventarioId}/conciliacao/resolver`, req);
  }

  /** Só resoluções `manter` podem ser reabertas. */
  reabrir(inventarioId: number, plaqueta: string) {
    return this.http.post<ConciliacaoItem>(`${this.base}/${inventarioId}/conciliacao/reabrir`, { plaqueta });
  }

  painel(inventarioId: number) {
    return this.http.get<PainelInventario>(`${this.base}/${inventarioId}/painel`);
  }
}
