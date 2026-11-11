import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ImobConferenciaDetalhe, ImobConferenciaDoBem, ImobConferenciaFiltro, ImobConferenciaLista, ImobConferenciaLoteItem, RelatorioImportacaoConferencias, ResultadoConferenciaLote
} from '../models/imob-leitura.model';
import { montarParams } from '../utils/http-params';
import { erroDeBlob } from '../utils/erro-blob';
import { ArquivoExportado } from './imob-bem.service';
import { Anexo } from '../models/anexo.model';
import { PagedResult } from '../models/paged-result.model';

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

  /** Esperado (congelado) × encontrado de um bem no ciclo, com o histórico de gravações (E28). 404 se não há conferência. */
  obter(inventarioId: number, bemId: number) {
    return this.http.get<ImobConferenciaDetalhe>(`${this.url(inventarioId)}/${bemId}`);
  }

  /** Conferências do bem em todos os ciclos de reavaliação, do mais recente ao mais antigo (E28 / US-28-03). */
  doBem(bemId: number, page = 1, pageSize = 20) {
    return this.http.get<PagedResult<ImobConferenciaDoBem>>(
      `${environment.apiUrl}/v1/imobilizado/bens/${bemId}/conferencias`, { params: montarParams({ page, pageSize }) });
  }

  // ── Fotos de evidência da conferência (E28 / US-28-02): pertencem à conferência, não ao cadastro do bem ──

  fotos(inventarioId: number, bemId: number) {
    return this.http.get<Anexo[]>(`${this.url(inventarioId)}/${bemId}/fotos`);
  }

  /** Sem `Content-Type` manual (boundary do multipart). `origem` só alimenta o histórico. */
  enviarFoto(inventarioId: number, bemId: number, arquivo: File, origem: 'web' | 'app' = 'web') {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    form.append('origem', origem);
    return this.http.post<Anexo>(`${this.url(inventarioId)}/${bemId}/fotos`, form);
  }

  excluirFoto(inventarioId: number, bemId: number, fotoId: number) {
    return this.http.delete<void>(`${this.url(inventarioId)}/${bemId}/fotos/${fotoId}`, { params: { origem: 'web' } });
  }

  /** Bytes da foto como blob (precisa do `X-Empresa-Id`, então nunca `<img src>` direto na API). */
  conteudoFoto(inventarioId: number, bemId: number, fotoId: number): Observable<Blob> {
    return this.http.get(`${this.url(inventarioId)}/${bemId}/fotos/${fotoId}/conteudo`, { responseType: 'blob' }).pipe(catchError(erroDeBlob));
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
