import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private http = inject(HttpClient);
  versao = signal('');

  carregar() {
    this.http.get<{ versao: string }>(`${environment.apiUrl}/v1/version`).subscribe({
      next: v => this.versao.set(v.versao),
      error: () => {}
    });
  }
}
