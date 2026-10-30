import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Integracao, SalvarIntegracaoRequest, TesteIntegracaoResultado } from '../models/empresa-config.model';

/** Integrações da empresa ativa (só admin). Stateless; o X-Empresa-Id vem do interceptor. */
@Injectable({ providedIn: 'root' })
export class EmpresaIntegracaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/empresa-ativa/integracoes`;

  listar() { return this.http.get<Integracao[]>(this.url); }
  criar(req: SalvarIntegracaoRequest) { return this.http.post<Integracao>(this.url, req); }
  atualizar(id: string, req: SalvarIntegracaoRequest) { return this.http.put<Integracao>(`${this.url}/${id}`, req); }
  excluir(id: string) { return this.http.delete<void>(`${this.url}/${id}`); }
  testar(id: string) { return this.http.post<TesteIntegracaoResultado>(`${this.url}/${id}/testar`, {}); }
}
