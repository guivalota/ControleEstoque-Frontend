import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  CriarEquipeMembro, EquipeEvento, EquipeMembro, EquipeSenhaProvisoria, PerfilEquipe
} from '../models/plataforma-equipe.model';

/**
 * Equipe da EMPRESA ATIVA pelo administrador da empresa (`v1/equipe`; o `X-Empresa-Id` vai pelo interceptor).
 * Mesmo contrato da equipe vista pelo super admin (`PlataformaEquipeService`), sem o id da empresa na rota.
 */
@Injectable({ providedIn: 'root' })
export class EquipeEmpresaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/equipe`;

  listar() {
    return this.http.get<EquipeMembro[]>(this.url);
  }

  criar(req: CriarEquipeMembro) {
    return this.http.post<EquipeSenhaProvisoria>(this.url, req);
  }

  alterarPerfil(usuarioId: string, perfil: PerfilEquipe) {
    return this.http.put<void>(`${this.url}/${usuarioId}/perfil`, { perfil });
  }

  redefinirSenha(usuarioId: string) {
    return this.http.post<EquipeSenhaProvisoria>(`${this.url}/${usuarioId}/redefinir-senha`, {});
  }

  definirAtivo(usuarioId: string, ativo: boolean) {
    return this.http.put<void>(`${this.url}/${usuarioId}/ativo`, { ativo });
  }

  eventos(page = 1, pageSize = 50) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<EquipeEvento>>(`${this.url}/eventos`, { params });
  }
}
