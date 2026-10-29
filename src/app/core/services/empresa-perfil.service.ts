import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  ConfigEvento, EmpresaPerfil, EmpresaPerfilEditavel, EmpresaPerfilOpcoes
} from '../models/empresa-perfil.model';

/** Perfil, fiscal, logo e histórico da empresa ativa (E17). O X-Empresa-Id vem do interceptor. */
@Injectable({ providedIn: 'root' })
export class EmpresaPerfilService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/empresa-ativa`;

  /** Object URL do logo da empresa ativa (null = sem logo ou não carregado). */
  logoUrl = signal<string | null>(null);

  obter() {
    return this.http.get<EmpresaPerfil>(`${this.base}/perfil`);
  }

  opcoes() {
    return this.http.get<EmpresaPerfilOpcoes>(`${this.base}/perfil/opcoes`);
  }

  /** O PUT recebe o documento completo: parte do que veio do servidor e sobrepõe só os campos da aba. */
  salvar(atual: EmpresaPerfil, alteracoes: Partial<EmpresaPerfilEditavel>) {
    return this.http.put<EmpresaPerfil>(`${this.base}/perfil`, EmpresaPerfilService.documento(atual, alteracoes));
  }

  static documento(atual: EmpresaPerfil, alteracoes: Partial<EmpresaPerfilEditavel>): EmpresaPerfilEditavel {
    const v = { ...atual, ...alteracoes };
    return {
      nomeFantasia: v.nomeFantasia, telefone: v.telefone, emailContato: v.emailContato, site: v.site,
      cep: v.cep, logradouro: v.logradouro, numero: v.numero, complemento: v.complemento, bairro: v.bairro,
      municipio: v.municipio, uf: v.uf, codigoIbge: v.codigoIbge,
      inscricaoEstadual: v.inscricaoEstadual, inscricaoMunicipal: v.inscricaoMunicipal, cnae: v.cnae,
      regimeTributario: v.regimeTributario, serieNfe: v.serieNfe, ambienteNfe: v.ambienteNfe
    };
  }

  /** Bytes do logo (404 = sem logo). */
  baixarLogo() {
    return this.http.get(`${this.base}/logo`, { responseType: 'blob' });
  }

  enviarLogo(arquivo: File) {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    return this.http.put<void>(`${this.base}/logo`, fd);
  }

  removerLogo() {
    return this.http.delete<void>(`${this.base}/logo`);
  }

  /** Carrega o logo para o signal `logoUrl`; qualquer falha (inclusive 404) deixa sem logo, sem quebrar. */
  carregarLogo(): Observable<void> {
    return this.baixarLogo().pipe(
      tap(blob => this.definirLogo(blob)),
      map(() => undefined),
      catchError(() => { this.definirLogo(null); return of(undefined); })
    );
  }

  definirLogo(blob: Blob | null) {
    const anterior = this.logoUrl();
    if (anterior) URL.revokeObjectURL(anterior);
    this.logoUrl.set(blob ? URL.createObjectURL(blob) : null);
  }

  historico(filtro: { area?: string; dataInicio?: string; dataFim?: string; page: number; pageSize: number }) {
    let params = new HttpParams().set('page', filtro.page).set('pageSize', Math.min(filtro.pageSize, 100));
    if (filtro.area) params = params.set('area', filtro.area);
    if (filtro.dataInicio) params = params.set('dataInicio', filtro.dataInicio);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    return this.http.get<PagedResult<ConfigEvento>>(`${this.base}/configuracoes/historico`, { params });
  }
}
