import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NfeService {
  private http = inject(HttpClient);

  importar(arquivo: File) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return this.http.post<any>(`${environment.apiUrl}/v1/nfe/importar`, form);
  }
}
