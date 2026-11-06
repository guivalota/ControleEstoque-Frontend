import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { montarParams } from '../utils/http-params';
import { carregarTodasPaginas } from '../utils/paginas';
import {
  AtualizarRecorrencia, AtualizarTitulo, CriarBaixa, CriarRecorrencia, CriarTitulo, CriarTituloParcelado, FiltroTitulos,
  Recorrencia, Titulo, TituloDetalhe, TituloParcelado
} from '../models/financeiro-titulos.model';

interface Pagina<T> { items: T[]; total: number; page: number; pageSize: number; }

/** Títulos a pagar e a receber, baixas, parcelamento e contas fixas (recorrências). Stateless. */
@Injectable({ providedIn: 'root' })
export class FinanceiroTitulosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/financeiro`;

  listar(filtro: FiltroTitulos) {
    return this.http.get<Pagina<Titulo>>(`${this.base}/titulos`, { params: montarParams(filtro) });
  }

  obter(id: number) {
    return this.http.get<TituloDetalhe>(`${this.base}/titulos/${id}`);
  }

  criar(req: CriarTitulo) {
    return this.http.post<TituloDetalhe>(`${this.base}/titulos`, req);
  }

  criarParcelado(req: CriarTituloParcelado) {
    return this.http.post<TituloParcelado>(`${this.base}/titulos/parcelado`, req);
  }

  atualizar(id: number, req: AtualizarTitulo) {
    return this.http.put<TituloDetalhe>(`${this.base}/titulos/${id}`, req);
  }

  cancelar(id: number, motivo: string) {
    return this.http.post<TituloDetalhe>(`${this.base}/titulos/${id}/cancelar`, { motivo });
  }

  baixar(id: number, req: CriarBaixa) {
    return this.http.post<TituloDetalhe>(`${this.base}/titulos/${id}/baixas`, req);
  }

  estornar(baixaId: number, motivo: string) {
    return this.http.post<TituloDetalhe>(`${this.base}/baixas/${baixaId}/estornar`, { motivo });
  }

  // ---- contas fixas
  recorrencias() {
    return carregarTodasPaginas<Recorrencia>((page, pageSize) =>
      this.http.get<Pagina<Recorrencia>>(`${this.base}/recorrencias`, { params: montarParams({ page, pageSize }) }));
  }

  criarRecorrencia(req: CriarRecorrencia) {
    return this.http.post<Recorrencia>(`${this.base}/recorrencias`, req);
  }

  atualizarRecorrencia(id: number, req: AtualizarRecorrencia) {
    return this.http.put<Recorrencia>(`${this.base}/recorrencias/${id}`, req);
  }
}
