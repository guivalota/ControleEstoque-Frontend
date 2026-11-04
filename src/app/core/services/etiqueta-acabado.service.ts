import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs';
import { erroDeBlob } from '../utils/erro-blob';
import { environment } from '../../../environments/environment';

export interface ModeloEtiquetaAcabado {
  codigo: string;
  descricao: string;
}

/** Modelos de folha (iguais aos do servidor, `GET etiquetas/modelos`). */
export const MODELOS_ETIQUETA_ACABADO: ModeloEtiquetaAcabado[] = [
  { codigo: 'rolo-50x30', descricao: 'Rolo 50 × 30 mm (térmica)' },
  { codigo: 'a4-21', descricao: 'Folha A4 com 21 etiquetas' }
];

/** Etiquetas de peça acabada (nome, tamanho/cor, SKU e código de barras) — PDF gerado no servidor. */
@Injectable({ providedIn: 'root' })
export class EtiquetaAcabadoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao`;

  modelos() {
    return this.http.get<ModeloEtiquetaAcabado[]>(`${this.base}/etiquetas/modelos`);
  }

  /** Peças escolhidas (variação + cópias de cada uma). */
  gerar(itens: { produtoId: number; copias: number }[], modelo: string) {
    return this.http.post(`${this.base}/etiquetas/acabado`, { modelo, itens }, { responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }

  /** Uma etiqueta por peça apontada na ordem. */
  daOrdem(ordemId: number, modelo: string) {
    return this.http.get(`${this.base}/ordens/${ordemId}/etiquetas`, { params: new HttpParams().set('modelo', modelo), responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }
}
