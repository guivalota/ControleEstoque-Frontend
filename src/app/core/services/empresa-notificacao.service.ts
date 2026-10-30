import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificacoesResponse, SalvarNotificacoesRequest } from '../models/empresa-config.model';

/** Destinatários dos avisos internos da empresa ativa (só admin). */
@Injectable({ providedIn: 'root' })
export class EmpresaNotificacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/empresa-ativa/notificacoes`;

  obter() { return this.http.get<NotificacoesResponse>(this.url); }
  salvar(req: SalvarNotificacoesRequest) { return this.http.put<NotificacoesResponse>(this.url, req); }
}
