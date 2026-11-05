import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreateGradeEixoRequest, CreateGradeValorRequest, GerarGradeRequest, GerarGradeResponse, GradeEixo, GradeProduto, GradeValor,
  UpdateGradeEixoRequest, UpdateGradeValorRequest
} from '../models/grade.model';

@Injectable({ providedIn: 'root' })
export class GradeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1`;

  eixos() {
    return this.http.get<GradeEixo[]>(`${this.base}/grade/eixos`);
  }

  criarEixo(req: CreateGradeEixoRequest) {
    return this.http.post<GradeEixo>(`${this.base}/grade/eixos`, req);
  }

  atualizarEixo(eixoId: number, req: UpdateGradeEixoRequest) {
    return this.http.put<GradeEixo>(`${this.base}/grade/eixos/${eixoId}`, req);
  }

  criarValor(eixoId: number, req: CreateGradeValorRequest) {
    return this.http.post<GradeValor>(`${this.base}/grade/eixos/${eixoId}/valores`, req);
  }

  atualizarValor(valorId: number, req: UpdateGradeValorRequest) {
    return this.http.put<GradeValor>(`${this.base}/grade/valores/${valorId}`, req);
  }

  obter(produtoId: number) {
    return this.http.get<GradeProduto>(`${this.base}/produtos/${produtoId}/grade`);
  }

  gerar(produtoId: number, req: GerarGradeRequest) {
    return this.http.post<GerarGradeResponse>(`${this.base}/produtos/${produtoId}/grade`, req);
  }
}
