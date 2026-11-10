import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ImobConferenciaFiltro, ImobConferenciaLista, ImobConferenciaLoteItem, RelatorioImportacaoConferencias, ResultadoConferenciaLote
} from '../models/imob-leitura.model';
import { montarParams } from '../utils/http-params';
import { erroDeBlob } from '../utils/erro-blob';
import { ArquivoExportado } from './imob-bem.service';

/** Conferência da reavaliação sem leitura de plaqueta (US-19-11). Só em inventário de reavaliação em andamento. */
@Injectable({ providedIn: 'root' })
export class ImobConferenciaService {
  private http = inject(HttpClient);

  private url(inventarioId: number) {
    return `${environment.apiUrl}/v1/imobilizado/inventarios/${inventarioId}/conferencias`;
  }

  /** Um bem esperado por linha, com o que foi conferido, e o resumo do ciclo (independe do filtro). */
  listar(inventarioId: number, filtro: ImobConferenciaFiltro = {}) {
    return this.http.get<ImobConferenciaLista>(this.url(inventarioId), { params: montarParams(filtro) });
  }

  /** Até 1000 itens (por `bemId` ou `plaqueta`); itens inválidos não impedem os válidos. */
  enviarLote(inventarioId: number, itens: ImobConferenciaLoteItem[]) {
    return this.http.post<ResultadoConferenciaLote>(`${this.url(inventarioId)}/lote`, { itens });
  }

  modelo(inventarioId: number): Observable<ArquivoExportado> {
    return this.http.get(`${this.url(inventarioId)}/importacao/modelo`, { responseType: 'blob', observe: 'response' }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
          ?? 'modelo-importacao-conferencias.csv'
      })),
      catchError(erroDeBlob)
    );
  }

  /** `apenasValidar` não grava nada. Sem `Content-Type` manual (boundary do multipart). */
  importar(inventarioId: number, arquivo: File, apenasValidar: boolean) {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    form.append('apenasValidar', String(apenasValidar));
    return this.http.post<RelatorioImportacaoConferencias>(`${this.url(inventarioId)}/importacao`, form);
  }
}
