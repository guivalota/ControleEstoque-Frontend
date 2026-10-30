import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  CriarEquipeMembro, EquipeEvento, EquipeMembro, EquipeSenhaProvisoria, PerfilEquipe
} from '../models/plataforma-equipe.model';

/** Equipe de qualquer empresa pelo super admin (empresa na rota; sem X-Empresa-Id). */
@Injectable({ providedIn: 'root' })
export class PlataformaEquipeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/plataforma/empresas`;

  private url(empresaId: number) {
    return `${this.base}/${empresaId}/equipe`;
  }

  listar(empresaId: number) {
    return this.http.get<EquipeMembro[]>(this.url(empresaId));
  }

  criar(empresaId: number, req: CriarEquipeMembro) {
    return this.http.post<EquipeSenhaProvisoria>(this.url(empresaId), req);
  }

  alterarPerfil(empresaId: number, usuarioId: string, perfil: PerfilEquipe) {
    return this.http.put<void>(`${this.url(empresaId)}/${usuarioId}/perfil`, { perfil });
  }

  redefinirSenha(empresaId: number, usuarioId: string) {
    return this.http.post<EquipeSenhaProvisoria>(`${this.url(empresaId)}/${usuarioId}/redefinir-senha`, {});
  }

  definirAtivo(empresaId: number, usuarioId: string, ativo: boolean) {
    return this.http.put<void>(`${this.url(empresaId)}/${usuarioId}/ativo`, { ativo });
  }

  eventos(empresaId: number, page = 1, pageSize = 50) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<EquipeEvento>>(`${this.url(empresaId)}/eventos`, { params });
  }
}
