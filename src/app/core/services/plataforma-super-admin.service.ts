import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CriarSuperAdmin, SuperAdmin, SuperAdminSenhaProvisoria } from '../models/plataforma-super-admin.model';

/** Contas de super administrador (`/v1/plataforma/super-admins`). */
@Injectable({ providedIn: 'root' })
export class PlataformaSuperAdminService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/plataforma/super-admins`;

  listar() {
    return this.http.get<SuperAdmin[]>(this.url);
  }

  criar(req: CriarSuperAdmin) {
    return this.http.post<SuperAdminSenhaProvisoria>(this.url, req);
  }

  redefinirSenha(id: string) {
    return this.http.post<SuperAdminSenhaProvisoria>(`${this.url}/${id}/redefinir-senha`, {});
  }

  definirAtivo(id: string, ativo: boolean) {
    return this.http.put<void>(`${this.url}/${id}/ativo`, { ativo });
  }
}
