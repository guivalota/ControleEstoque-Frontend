import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ConfiguracaoResumo } from '../models/empresa-perfil.model';
import { PagedResult } from '../models/paged-result.model';
import {
  AdminInicialResponse, AtualizarPlataformaEmpresa, CriarAdminInicial, CriarPlataformaEmpresa, EmpresaBloqueio,
  OnboardingEmpresa, OnboardingResponse, PlataformaEmpresa
} from '../models/plataforma-empresa.model';

/** Empresas na administração da plataforma (super admin). Sem X-Empresa-Id. */
@Injectable({ providedIn: 'root' })
export class PlataformaEmpresaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/plataforma/empresas`;

  listar(page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<PlataformaEmpresa>>(this.url, { params });
  }

  obter(id: number) {
    return this.http.get<PlataformaEmpresa>(`${this.url}/${id}`);
  }

  criar(req: CriarPlataformaEmpresa) {
    return this.http.post<PlataformaEmpresa>(this.url, req);
  }

  atualizar(id: number, req: AtualizarPlataformaEmpresa) {
    return this.http.put<PlataformaEmpresa>(`${this.url}/${id}`, req);
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Cria o primeiro administrador; a senha provisória vem só nesta resposta (não guardar). */
  criarAdminInicial(id: number, req: CriarAdminInicial) {
    return this.http.post<AdminInicialResponse>(`${this.url}/${id}/admin-inicial`, req);
  }

  /** Cria empresa, plano, módulos e admin inicial numa chamada (tudo ou nada). */
  onboarding(req: OnboardingEmpresa) {
    return this.http.post<OnboardingResponse>(`${this.url}/onboarding`, req);
  }

  /** Bloqueia a empresa (motivo obrigatório, até 300 caracteres). */
  bloquear(id: number, motivo: string) {
    return this.http.post<PlataformaEmpresa>(`${this.url}/${id}/bloquear`, { motivo });
  }

  desbloquear(id: number, motivo?: string | null) {
    return this.http.post<PlataformaEmpresa>(`${this.url}/${id}/desbloquear`, motivo ? { motivo } : {});
  }

  /** Estado da configuração da empresa (só identificação e estado; sem segredos). */
  configuracaoResumo(id: number) {
    return this.http.get<ConfiguracaoResumo>(`${this.url}/${id}/configuracao-resumo`);
  }

  bloqueios(id: number, page = 1, pageSize = 50) {
    const params = new HttpParams().set('page', page).set('pageSize', Math.min(pageSize, 100));
    return this.http.get<PagedResult<EmpresaBloqueio>>(`${this.url}/${id}/bloqueios`, { params });
  }
}
