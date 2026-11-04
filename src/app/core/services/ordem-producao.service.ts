import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { Corte, RegistrarCorteRequest } from '../models/corte-producao.model';
import { Apontamento, ApontamentoRegistrado, ApontarProducaoRequest, CreateOrdemProducaoRequest, LiberacaoOrdem, OrdemProducao } from '../models/ordem-producao.model';

@Injectable({ providedIn: 'root' })
export class OrdemProducaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/producao/ordens`;

  listar(page: number, pageSize: number, status?: string, busca?: string) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    if (busca) params = params.set('busca', busca);
    return this.http.get<PagedResult<OrdemProducao>>(this.base, { params });
  }

  obter(id: number) {
    return this.http.get<OrdemProducao>(`${this.base}/${id}`);
  }

  criar(req: CreateOrdemProducaoRequest) {
    return this.http.post<OrdemProducao>(this.base, req);
  }

  /** Reserva os materiais. Com falta e sem `confirmarFalta` o servidor não libera e devolve as faltas. */
  liberar(id: number, confirmarFalta: boolean) {
    return this.http.post<LiberacaoOrdem>(`${this.base}/${id}/liberar`, { confirmarFalta });
  }

  iniciar(id: number) {
    return this.http.post<OrdemProducao>(`${this.base}/${id}/iniciar`, {});
  }

  concluir(id: number) {
    return this.http.post<OrdemProducao>(`${this.base}/${id}/concluir`, {});
  }

  apontamentos(id: number) {
    return this.http.get<Apontamento[]>(`${this.base}/${id}/apontamentos`);
  }

  /** Tudo ou nada: baixa os materiais e dá entrada no acabado. Passando do planejado só grava com `confirmarSobreproducao`. */
  apontar(id: number, req: ApontarProducaoRequest) {
    return this.http.post<ApontamentoRegistrado>(`${this.base}/${id}/apontamentos`, req);
  }

  cortes(id: number) {
    return this.http.get<Corte[]>(`${this.base}/${id}/cortes`);
  }

  /** Baixa o tecido (usado − retalho) e guarda as peças cortadas por tamanho; sem saldo nada é registrado. */
  registrarCorte(id: number, req: RegistrarCorteRequest) {
    return this.http.post<Corte>(`${this.base}/${id}/cortes`, req);
  }

  cancelar(id: number, motivo: string) {
    return this.http.post<OrdemProducao>(`${this.base}/${id}/cancelar`, { motivo });
  }
}
