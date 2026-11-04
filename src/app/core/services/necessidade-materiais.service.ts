import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NecessidadeMaterial, PedidosGerados } from '../models/necessidade-materiais.model';

@Injectable({ providedIn: 'root' })
export class NecessidadeMateriaisService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao`;

  consultar() {
    return this.http.get<NecessidadeMaterial[]>(`${this.base}/necessidade-materiais`);
  }

  /** Cria um pedido de compra por fornecedor preferencial; sem `materialIds` inclui todos os que precisam de compra. */
  gerarPedidos(materialIds: number[] = []) {
    return this.http.post<PedidosGerados>(`${this.base}/necessidade-materiais/gerar-pedidos`, { materialIds });
  }

  definirFornecedor(materialId: number, fornecedorId: number, prazoEntregaDias: number | null) {
    return this.http.put<void>(`${this.base}/materiais/${materialId}/fornecedor`, { fornecedorId, prazoEntregaDias });
  }

  removerFornecedor(materialId: number) {
    return this.http.delete<void>(`${this.base}/materiais/${materialId}/fornecedor`);
  }
}
