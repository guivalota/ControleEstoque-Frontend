import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CepResult } from '../models/cep.model';

@Injectable({ providedIn: 'root' })
export class CepService {
  private http = inject(HttpClient);

  lookup(cep: string) {
    const digits = cep.replace(/\D/g, '');
    return this.http.get<CepResult>(`${environment.apiUrl}/v1/cep/${digits}`).pipe(
      map(res => ({
        ...res,
        municipio: res.municipio ?? res.localidade
      }))
    );
  }
}
