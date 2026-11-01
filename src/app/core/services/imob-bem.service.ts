import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImobBem, ImobBemFiltro, ImobBemHistorico, SalvarImobBem } from '../models/imob-bem.model';
import { CodigoAnterior, DeParaItem, ResultadoDePara } from '../models/imob-renovacao.model';
import { PagedResult } from '../models/paged-result.model';
import { erroDeBlob } from '../utils/erro-blob';
import { montarParams } from '../utils/http-params';

export interface ArquivoExportado {
  blob: Blob;
  nome: string;
}

@Injectable({ providedIn: 'root' })
export class ImobBemService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/imobilizado/bens`;

  /** `incluirSublocais` só vai na query quando é `false` (o padrão do servidor é `true`). */
  private params(filtro: ImobBemFiltro): HttpParams {
    const { incluirSublocais, ...resto } = filtro;
    return montarParams({ ...resto, incluirSublocais: incluirSublocais === false ? false : undefined });
  }

  listar(filtro: ImobBemFiltro = {}) {
    return this.http.get<PagedResult<ImobBem>>(this.url, { params: this.params(filtro) });
  }

  obter(id: number) {
    return this.http.get<ImobBem>(`${this.url}/${id}`);
  }

  porPlaqueta(plaqueta: string) {
    return this.http.get<ImobBem>(`${this.url}/por-plaqueta`, { params: new HttpParams().set('plaqueta', plaqueta) });
  }

  /** Trilha de alterações, do mais recente para o mais antigo. */
  historico(id: number, page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<ImobBemHistorico>>(`${this.url}/${id}/historico`, { params });
  }

  criar(req: SalvarImobBem) {
    return this.http.post<ImobBem>(this.url, req);
  }

  atualizar(id: number, req: SalvarImobBem) {
    return this.http.put<ImobBem>(`${this.url}/${id}`, req);
  }

  /** De-para de etiquetas (admin). Atômico: qualquer par inválido → 400 e nada é gravado. */
  aplicarDePara(itens: DeParaItem[]) {
    return this.http.post<ResultadoDePara>(`${this.url}/de-para`, { itens });
  }

  obterCodigoAnterior() {
    return this.http.get<CodigoAnterior>(`${this.url}/codigo-anterior`);
  }

  /** Virada (admin): `oculto: true` esconde os códigos antigos; `false` desfaz. */
  definirCodigoAnterior(oculto: boolean) {
    return this.http.put<CodigoAnterior>(`${this.url}/codigo-anterior`, { oculto });
  }

  excluir(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** PDF de conferência (por local e plaqueta, com espaço para a plaqueta nova) dos bens do filtro. */
  conferenciaPdf(filtro: ImobBemFiltro = {}): Observable<ArquivoExportado> {
    return this.baixar('conferencia', filtro, 'conferencia-bens.pdf');
  }

  /** CSV com os mesmos filtros da listagem (sem paginação). Baixa via HttpClient por causa do X-Empresa-Id. */
  exportar(filtro: ImobBemFiltro = {}): Observable<ArquivoExportado> {
    return this.baixar('exportar', filtro, 'bens.csv');
  }

  private baixar(rota: string, filtro: ImobBemFiltro, nomePadrao: string): Observable<ArquivoExportado> {
    const { page, pageSize, ...semPaginacao } = filtro;
    void page; void pageSize;
    return this.http.get(`${this.url}/${rota}`, {
      params: this.params(semPaginacao), responseType: 'blob', observe: 'response'
    }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? nomePadrao
      })),
      catchError(erroDeBlob)
    );
  }
}
