import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreateGradeValorRequest, GerarGradeRequest, GerarGradeResponse, GradeEixo, GradeProduto, GradeValor
} from '../models/grade.model';

@Injectable({ providedIn: 'root' })
export class GradeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1`;

  eixos() {
    return this.http.get<GradeEixo[]>(`${this.base}/grade/eixos`);
  }

  criarValor(eixoId: number, req: CreateGradeValorRequest) {
    return this.http.post<GradeValor>(`${this.base}/grade/eixos/${eixoId}/valores`, req);
  }

  obter(produtoId: number) {
    return this.http.get<GradeProduto>(`${this.base}/produtos/${produtoId}/grade`);
  }

  gerar(produtoId: number, req: GerarGradeRequest) {
    return this.http.post<GerarGradeResponse>(`${this.base}/produtos/${produtoId}/grade`, req);
  }
}
