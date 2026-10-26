import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RelatorioImportacao, ResultadoImportacao } from '../models/imob-importacao.model';
import { erroDeBlob } from '../utils/erro-blob';
import { ArquivoExportado } from './imob-bem.service';

@Injectable({ providedIn: 'root' })
export class ImobImportacaoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/bens/importacao`;

  /** Baixa via HttpClient (e não `<a href>`) por causa do X-Empresa-Id. */
  modelo(): Observable<ArquivoExportado> {
    return this.http.get(`${this.url}/modelo`, { responseType: 'blob', observe: 'response' }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
          ?? 'modelo-importacao-bens.csv'
      })),
      catchError(erroDeBlob)
    );
  }

  /** Não grava nada. Sem `Content-Type` manual: o navegador inclui o boundary do multipart. */
  validar(arquivo: File, localPadraoId?: number | null) {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    if (localPadraoId != null) form.append('localPadraoId', String(localPadraoId));
    return this.http.post<RelatorioImportacao>(`${this.url}/validar`, form);
  }

  /** Reenvia o mesmo arquivo com o hash devolvido pela validação. */
  confirmar(arquivo: File, hashArquivo: string, localPadraoId?: number | null, apenasValidas = false) {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    form.append('hashArquivo', hashArquivo);
    if (localPadraoId != null) form.append('localPadraoId', String(localPadraoId));
    if (apenasValidas) form.append('importarApenasValidas', 'true');
    return this.http.post<ResultadoImportacao>(`${this.url}/confirmar`, form);
  }
}
