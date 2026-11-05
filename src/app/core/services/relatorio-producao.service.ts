import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs';
import { erroDeBlob } from '../utils/erro-blob';
import { environment } from '../../../environments/environment';
import { CustoOrdens, DashboardProducao, ProducaoPeriodo } from '../models/relatorio-producao.model';

export type RelatorioProducaoTipo = 'custo-ordens' | 'producao';

@Injectable({ providedIn: 'root' })
export class RelatorioProducaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao`;

  dashboard() {
    return this.http.get<DashboardProducao>(`${this.base}/dashboard`);
  }

  custoOrdens(de?: string, ate?: string) {
    return this.http.get<CustoOrdens>(`${this.base}/relatorios/custo-ordens`, { params: this.periodo(de, ate) });
  }

  producao(de?: string, ate?: string) {
    return this.http.get<ProducaoPeriodo>(`${this.base}/relatorios/producao`, { params: this.periodo(de, ate) });
  }

  /** Arquivo do relatório (CSV ou PDF) com os mesmos filtros da tela. */
  exportar(tipo: RelatorioProducaoTipo, formato: 'csv' | 'pdf', de?: string, ate?: string) {
    return this.http.get(`${this.base}/relatorios/${tipo}`, { params: this.periodo(de, ate).set('formato', formato), responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }

  private periodo(de?: string, ate?: string) {
    let params = new HttpParams();
    if (de) params = params.set('de', de);
    if (ate) params = params.set('ate', ate);
    return params;
  }
}
