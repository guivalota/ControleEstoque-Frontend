import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertaEstoqueBaixoResponse } from '../models/alerta.model';

@Injectable({ providedIn: 'root' })
export class AlertaService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/v1/alertas`;

  enviarAlertaEstoqueBaixo(email?: string): Observable<AlertaEstoqueBaixoResponse> {
    const params = email ? new HttpParams().set('email', email) : undefined;
    return this.http.post<AlertaEstoqueBaixoResponse>(`${this.baseUrl}/estoque-baixo`, null, { params });
  }
}
