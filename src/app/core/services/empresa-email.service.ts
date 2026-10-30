import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EmailEmpresa, SalvarEmailEmpresaRequest, TesteEmailResultado } from '../models/empresa-config.model';

/** E-mail próprio da empresa ativa (só admin). A senha é write-only. */
@Injectable({ providedIn: 'root' })
export class EmpresaEmailService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/empresa-ativa/email`;

  obter() { return this.http.get<EmailEmpresa>(this.url); }
  salvar(req: SalvarEmailEmpresaRequest) { return this.http.put<EmailEmpresa>(this.url, req); }
  testar(destinatario: string) { return this.http.post<TesteEmailResultado>(`${this.url}/testar`, { destinatario }); }
}
