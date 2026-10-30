import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CriarImobEscala, ImobEscala, ImobEscalaNota, ImobEscalasVigentes, TipoEscala
} from '../models/imob-reavaliacao.model';
import { PagedResult } from '../models/paged-result.model';

/** Escalas VP (idade → nota) e VF (nota de vida remanescente → nota), versionadas. */
@Injectable({ providedIn: 'root' })
export class ImobReavaliacaoEscalaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/reavaliacao/escalas`;

  vigentes() {
    return this.http.get<ImobEscalasVigentes>(this.url);
  }

  vigente(tipo: TipoEscala) {
    return this.http.get<ImobEscala>(`${this.url}/${tipo}`);
  }

  historico(tipo: TipoEscala, page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobEscala>>(`${this.url}/${tipo}/historico`, { params });
  }

  versao(tipo: TipoEscala, id: number) {
    return this.http.get<ImobEscala>(`${this.url}/${tipo}/versoes/${id}`);
  }

  /** Prévia: qual nota a versão vigente dá a este valor (negativo conta como 0). */
  nota(tipo: TipoEscala, valor: number) {
    return this.http.get<ImobEscalaNota>(`${this.url}/${tipo}/nota`, { params: new HttpParams().set('valor', valor) });
  }

  criarVersao(tipo: TipoEscala, req: CriarImobEscala) {
    return this.http.post<ImobEscala>(`${this.url}/${tipo}`, req);
  }
}
