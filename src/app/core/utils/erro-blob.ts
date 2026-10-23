import { HttpErrorResponse } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';

/**
 * Com `responseType: 'blob'` o corpo do erro também chega como Blob; reconstrói o erro com o
 * JSON/texto original para que `lerErroApi` consiga ler a mensagem do servidor.
 */
export function erroDeBlob(err: HttpErrorResponse): Observable<never> {
  if (!(err.error instanceof Blob)) return throwError(() => err);
  return from(err.error.text()).pipe(
    switchMap(texto => {
      let corpo: unknown = texto;
      try { corpo = JSON.parse(texto); } catch { /* texto puro */ }
      return throwError(() => new HttpErrorResponse({
        error: corpo, status: err.status, statusText: err.statusText, headers: err.headers, url: err.url ?? undefined
      }));
    })
  );
}
