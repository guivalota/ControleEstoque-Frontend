import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ImobLeitura, ImobLeituraFiltro, ImobLeituraInfo, ImobLeituraRegistrada, RegistrarImobLeitura,
  RelatorioImportacaoLeituras, ResultadoLote
} from '../models/imob-leitura.model';
import { PagedResult } from '../models/paged-result.model';
import { erroDeBlob } from '../utils/erro-blob';
import { montarParams } from '../utils/http-params';
import { ArquivoExportado } from './imob-bem.service';

@Injectable({ providedIn: 'root' })
export class ImobLeituraService {
  private http = inject(HttpClient);

  private url(inventarioId: number) {
    return `${environment.apiUrl}/v1/imobilizado/inventarios/${inventarioId}/leituras`;
  }

  listar(inventarioId: number, filtro: ImobLeituraFiltro = {}) {
    return this.http.get<PagedResult<ImobLeitura>>(this.url(inventarioId), { params: montarParams(filtro) });
  }

  /** Consulta a plaqueta sem gravar nada. */
  info(inventarioId: number, plaqueta: string) {
    return this.http.get<ImobLeituraInfo>(`${this.url(inventarioId)}/info`, { params: montarParams({ plaqueta }) });
  }

  /** Reenviar o mesmo `clientId` é seguro: o servidor devolve a leitura original (`reaproveitada`). */
  registrar(inventarioId: number, req: RegistrarImobLeitura) {
    return this.http.post<ImobLeituraRegistrada>(this.url(inventarioId), req);
  }

  /** Anulação lógica. */
  anular(inventarioId: number, id: number) {
    return this.http.delete<void>(`${this.url(inventarioId)}/${id}`);
  }

  enviarLote(inventarioId: number, leituras: RegistrarImobLeitura[]) {
    return this.http.post<ResultadoLote>(`${this.url(inventarioId)}/lote`, { leituras });
  }

  modelo(inventarioId: number): Observable<ArquivoExportado> {
    return this.http.get(`${this.url(inventarioId)}/importacao/modelo`, { responseType: 'blob', observe: 'response' }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
          ?? 'modelo-importacao-leituras.csv'
      })),
      catchError(erroDeBlob)
    );
  }

  /** Sem `Content-Type` manual (boundary do multipart). `apenasValidar` não grava nada. */
  importar(inventarioId: number, arquivo: File, apenasValidar: boolean, localPadraoId?: number | null) {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    if (localPadraoId != null) form.append('localPadraoId', String(localPadraoId));
    form.append('apenasValidar', String(apenasValidar));
    return this.http.post<RelatorioImportacaoLeituras>(`${this.url(inventarioId)}/importacao`, form);
  }
}
