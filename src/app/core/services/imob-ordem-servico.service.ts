import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CriarImobOs, ImobOs, ImobOsFiltro, ImobOsResumo } from '../models/imob-ordem-servico.model';
import { PagedResult } from '../models/paged-result.model';
import { montarParams } from '../utils/http-params';

@Injectable({ providedIn: 'root' })
export class ImobOrdemServicoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/ordens-servico`;

  listar(filtro: ImobOsFiltro = {}) {
    return this.http.get<PagedResult<ImobOsResumo>>(this.url, { params: montarParams(filtro) });
  }

  obter(id: number) {
    return this.http.get<ImobOs>(`${this.url}/${id}`);
  }

  /** Não altera o bem: ele só muda quando um admin aprova. */
  abrir(req: CriarImobOs) {
    return this.http.post<ImobOs>(this.url, req);
  }

  /** Admin. Transferência/sinistro/venda/baixa viram `concluida`; manutenção fica `aprovada`. */
  aprovar(id: number, comentario?: string) {
    return this.http.post<ImobOs>(`${this.url}/${id}/aprovar`, { comentario: comentario || undefined });
  }

  /** Admin; o comentário é obrigatório. */
  rejeitar(id: number, comentario: string) {
    return this.http.post<ImobOs>(`${this.url}/${id}/rejeitar`, { comentario });
  }

  /** Solicitante ou admin (pendente); só admin cancela manutenção já aprovada. */
  cancelar(id: number, comentario?: string) {
    return this.http.post<ImobOs>(`${this.url}/${id}/cancelar`, { comentario: comentario || undefined });
  }

  /** Manutenção aprovada: devolve os bens para `ativo`. */
  concluir(id: number, custoReal?: number | null, comentario?: string) {
    return this.http.post<ImobOs>(`${this.url}/${id}/concluir`, {
      custoReal: custoReal ?? undefined, comentario: comentario || undefined
    });
  }
}
