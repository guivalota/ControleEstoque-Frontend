import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DefinirPlanoDaEmpresa, Plano, SalvarPlano, UsoEmpresa } from '../models/plataforma-plano.model';

/** Planos e limites (super admin). Sem X-Empresa-Id. */
@Injectable({ providedIn: 'root' })
export class PlataformaPlanoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/plataforma`;

  listar() {
    return this.http.get<Plano[]>(`${this.url}/planos`);
  }

  obter(id: number) {
    return this.http.get<Plano>(`${this.url}/planos/${id}`);
  }

  criar(req: SalvarPlano) {
    return this.http.post<Plano>(`${this.url}/planos`, req);
  }

  atualizar(id: number, req: SalvarPlano) {
    return this.http.put<Plano>(`${this.url}/planos/${id}`, req);
  }

  definirAtivo(id: number, ativo: boolean) {
    return this.http.put<void>(`${this.url}/planos/${id}/ativo`, { ativo });
  }

  definirPlanoDaEmpresa(empresaId: number, req: DefinirPlanoDaEmpresa) {
    return this.http.put<void>(`${this.url}/empresas/${empresaId}/plano`, req);
  }

  /** Sobrescreve limites só desta empresa; objeto vazio remove as sobrescritas. */
  definirLimitesDaEmpresa(empresaId: number, limites: Record<string, number>) {
    return this.http.put<void>(`${this.url}/empresas/${empresaId}/limites`, { limites });
  }

  uso(empresaId: number) {
    return this.http.get<UsoEmpresa>(`${this.url}/empresas/${empresaId}/uso`);
  }
}
