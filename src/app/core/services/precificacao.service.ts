import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Precificacao } from '../models/precificacao.model';

@Injectable({ providedIn: 'root' })
export class PrecificacaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao/produtos`;

  obter(produtoId: number) {
    return this.http.get<Precificacao>(`${this.base}/${produtoId}/precificacao`);
  }

  definir(produtoId: number, margemPercentual: number, despesasVendaPercentual: number) {
    return this.http.put<Precificacao>(`${this.base}/${produtoId}/precificacao`, { margemPercentual, despesasVendaPercentual });
  }
}
