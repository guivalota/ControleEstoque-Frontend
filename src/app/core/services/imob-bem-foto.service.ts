import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Anexo } from '../models/anexo.model';
import { erroDeBlob } from '../utils/erro-blob';

/** Fotos do bem (E27): stateless. O conteúdo vem como blob (precisa do `X-Empresa-Id`, então nunca `<img src>` direto na API). */
@Injectable({ providedIn: 'root' })
export class ImobBemFotoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/imobilizado/bens`;

  private url(bemId: number) { return `${this.base}/${bemId}/fotos`; }

  listar(bemId: number) {
    return this.http.get<Anexo[]>(this.url(bemId));
  }

  /** Sem `Content-Type` manual: o navegador inclui o boundary do multipart. */
  enviar(bemId: number, arquivo: File) {
    const form = new FormData();
    form.append('arquivo', arquivo, arquivo.name);
    return this.http.post<Anexo>(this.url(bemId), form);
  }

  excluir(bemId: number, fotoId: number) {
    return this.http.delete<void>(`${this.url(bemId)}/${fotoId}`);
  }

  conteudo(bemId: number, fotoId: number): Observable<Blob> {
    return this.http.get(`${this.url(bemId)}/${fotoId}/conteudo`, { responseType: 'blob' }).pipe(catchError(erroDeBlob));
  }
}
