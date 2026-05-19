import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ConferenciaResult } from '../models/conferencia.model';

@Injectable({ providedIn: 'root' })
export class ConferenciaService {
  private http = inject(HttpClient);

  conferir(produtoId: number) {
    return this.http.get<ConferenciaResult>(
      `${environment.apiUrl}/conferencia/${produtoId}`
    );
  }
}
