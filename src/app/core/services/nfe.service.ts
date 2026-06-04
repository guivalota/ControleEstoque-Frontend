import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AnaliseNfeResponse, ImportarNfeResponse, ResolucaoItem } from '../models/nfe.model';

@Injectable({ providedIn: 'root' })
export class NfeService {
  private http = inject(HttpClient);

  analisar(arquivo: File) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return this.http.post<AnaliseNfeResponse>(`${environment.apiUrl}/v1/nfe/analisar`, form);
  }

  importar(arquivo: File, resolucoes: ResolucaoItem[]) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('resolucoes', JSON.stringify(resolucoes));
    return this.http.post<ImportarNfeResponse>(`${environment.apiUrl}/v1/nfe/importar`, form);
  }
}
