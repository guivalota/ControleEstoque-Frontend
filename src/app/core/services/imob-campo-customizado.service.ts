import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  AtualizarImobCampoCustomizado, CriarImobCampoCustomizado, ImobCampoCustomizado
} from '../models/imob-campo-customizado.model';

/** Definição dos campos customizados do bem (stateless). Os valores vão e vêm com o bem. */
@Injectable({ providedIn: 'root' })
export class ImobCampoCustomizadoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/campos-customizados`;

  /** Por padrão só os ativos (o que o formulário do bem precisa); a tela de configuração pede todos. */
  listar(incluirInativos = false) {
    const params = incluirInativos ? new HttpParams().set('incluirInativos', true) : new HttpParams();
    return this.http.get<ImobCampoCustomizado[]>(this.url, { params });
  }

  criar(req: CriarImobCampoCustomizado) {
    return this.http.post<ImobCampoCustomizado>(this.url, req);
  }

  atualizar(id: number, req: AtualizarImobCampoCustomizado) {
    return this.http.put<ImobCampoCustomizado>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
