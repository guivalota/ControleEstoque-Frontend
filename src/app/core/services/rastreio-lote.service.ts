import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { OrdemLotes, RastreioLote } from '../models/rastreio-lote.model';

@Injectable({ providedIn: 'root' })
export class RastreioLoteService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao`;

  /** Lotes que a ordem consumiu e lotes de acabado que gerou. */
  daOrdem(ordemId: number) {
    return this.http.get<OrdemLotes>(`${this.base}/ordens/${ordemId}/lotes`);
  }

  /** Rastreio do lote nos dois sentidos (material → acabado e acabado → material). */
  rastrear(loteId: number) {
    return this.http.get<RastreioLote>(`${this.base}/rastreio/lotes/${loteId}`);
  }
}
