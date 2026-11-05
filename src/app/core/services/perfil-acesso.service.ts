import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CatalogoPermissoes, PerfilAcesso, PerfilAcessoDetalhe, SalvarPerfilAcesso
} from '../models/perfil-acesso.model';

/** Perfis de acesso e catálogo de permissões da empresa ativa (`v1/perfis`, `v1/permissoes`; `X-Empresa-Id` pelo interceptor). */
@Injectable({ providedIn: 'root' })
export class PerfilAcessoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/perfis`;

  listar() {
    return this.http.get<PerfilAcesso[]>(this.url);
  }

  obter(id: number) {
    return this.http.get<PerfilAcessoDetalhe>(`${this.url}/${id}`);
  }

  criar(req: SalvarPerfilAcesso) {
    return this.http.post<PerfilAcessoDetalhe>(this.url, req);
  }

  atualizar(id: number, req: SalvarPerfilAcesso) {
    return this.http.put<PerfilAcessoDetalhe>(`${this.url}/${id}`, { nome: req.nome, descricao: req.descricao, permissoes: req.permissoes });
  }

  restaurarPadrao(id: number) {
    return this.http.post<PerfilAcessoDetalhe>(`${this.url}/${id}/restaurar-padrao`, {});
  }

  definirAtivo(id: number, ativo: boolean) {
    return this.http.put<void>(`${this.url}/${id}/ativo`, { ativo });
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  catalogo() {
    return this.http.get<CatalogoPermissoes>(`${environment.apiUrl}/v1/permissoes`);
  }
}
