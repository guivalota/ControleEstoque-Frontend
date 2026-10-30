import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { DefinirEmpresaModulo, EmpresaModulo, EmpresaModuloEvento } from '../models/plataforma-modulo.model';

/** Módulos por empresa (super admin). Sem X-Empresa-Id. */
@Injectable({ providedIn: 'root' })
export class PlataformaModuloService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/plataforma/empresas`;

  listar(empresaId: number) {
    return this.http.get<EmpresaModulo[]>(`${this.url}/${empresaId}/modulos`);
  }

  definir(empresaId: number, codigo: string, req: DefinirEmpresaModulo) {
    return this.http.put<void>(`${this.url}/${empresaId}/modulos/${encodeURIComponent(codigo)}`, req);
  }

  eventos(empresaId: number, page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<EmpresaModuloEvento>>(`${this.url}/${empresaId}/modulos/eventos`, { params });
  }
}
