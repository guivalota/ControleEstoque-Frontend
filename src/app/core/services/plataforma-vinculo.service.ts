import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ImobPerfil } from '../models/imob-empresa.model';

/**
 * Vínculo conta <-> empresa pelo super admin (D-031/D-035, um usuário, uma empresa).
 * `POST/DELETE v1/plataforma/empresas/{id}/usuarios`; erros 400 do servidor são exibidos como vieram.
 */
@Injectable({ providedIn: 'root' })
export class PlataformaVinculoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/plataforma/empresas`;

  vincular(empresaId: number, usuarioId: string, perfil?: ImobPerfil | null) {
    return this.http.post<void>(`${this.base}/${empresaId}/usuarios`, perfil ? { usuarioId, perfil } : { usuarioId });
  }

  desvincular(empresaId: number, usuarioId: string) {
    return this.http.delete<void>(`${this.base}/${empresaId}/usuarios/${usuarioId}`);
  }
}
