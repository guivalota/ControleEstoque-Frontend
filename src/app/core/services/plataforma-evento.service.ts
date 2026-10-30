import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  LogSistema, LogSistemaFiltros, PlataformaEvento, PlataformaEventoFiltros
} from '../models/plataforma-evento.model';
import { montarParams } from '../utils/http-params';

/** Trilha da plataforma e logs do sistema (só super admin; sem X-Empresa-Id). */
@Injectable({ providedIn: 'root' })
export class PlataformaEventoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/plataforma`;

  /** `pageSize` é limitado a 100 (máximo do servidor). */
  eventos(filtros: PlataformaEventoFiltros = {}) {
    const f = { ...filtros, pageSize: Math.min(filtros.pageSize ?? 50, 100) };
    return this.http.get<PagedResult<PlataformaEvento>>(`${this.base}/eventos`, { params: montarParams(f) });
  }

  /** Logs técnicos do sistema; sem filtro de empresa/usuário (a tabela não os tem). */
  logs(filtros: LogSistemaFiltros = {}) {
    const f = { ...filtros, pageSize: Math.min(filtros.pageSize ?? 50, 100) };
    return this.http.get<PagedResult<LogSistema>>(`${this.base}/logs`, { params: montarParams(f) });
  }
}
