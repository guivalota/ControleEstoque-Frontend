import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AgruparRazao, AjudaDepreciacao, AjudaSecao, ComparacaoRevisoes, DepreciacaoBem, DimensaoRelatorio,
  HistoricoPeriodo, ListaPeriodos, PainelDepreciacao, PeriodoFechado, PreviaDepreciacao, RelatorioBaixas,
  RelatorioBensPorDimensao, RelatorioRazao, RelatorioValorContabil, RevisaoPeriodo
} from '../models/imob-depreciacao.model';
import { erroDeBlob } from '../utils/erro-blob';
import { montarParams } from '../utils/http-params';
import { ArquivoExportado } from './imob-bem.service';

export type FormatoArquivo = 'csv' | 'pdf';

interface PaginacaoFiltro { page?: number; pageSize?: number }

export interface FiltroValorContabil extends PaginacaoFiltro {
  em?: string; categoriaId?: number; localId?: number; responsavelId?: number; status?: string;
}

@Injectable({ providedIn: 'root' })
export class ImobDepreciacaoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/imobilizado/depreciacao`;

  // --- Bem e ajuda (4.1) ---

  doBem(bemId: number, filtro: PaginacaoFiltro & { em?: string } = {}) {
    return this.http.get<DepreciacaoBem>(`${this.base}/bens/${bemId}`, { params: montarParams(filtro) });
  }

  /** Conteúdo global: não usa `X-Empresa-Id` (o interceptor só o envia nas rotas de dados da empresa, mas o servidor ignora). */
  ajuda(q?: string) {
    return this.http.get<AjudaDepreciacao>(`${this.base}/ajuda`, { params: montarParams({ q }) });
  }

  ajudaSecao(slug: string) {
    return this.http.get<AjudaSecao>(`${this.base}/ajuda/${encodeURIComponent(slug)}`);
  }

  // --- Painel (4.4) ---

  painel() {
    return this.http.get<PainelDepreciacao>(`${this.base}/dashboard`);
  }

  // --- Períodos (4.2) ---

  previa(competencia: string, filtro: PaginacaoFiltro = {}) {
    return this.http.get<PreviaDepreciacao>(`${this.base}/previa`, { params: montarParams({ competencia, ...filtro }) });
  }

  periodos(filtro: PaginacaoFiltro = {}) {
    return this.http.get<ListaPeriodos>(`${this.base}/periodos`, { params: montarParams(filtro) });
  }

  fechar(mes: string) {
    return this.http.post<PeriodoFechado>(`${this.base}/periodos/${mes}/fechar`, null);
  }

  reabrir(mes: string, motivo: string) {
    return this.http.post<HistoricoPeriodo>(`${this.base}/periodos/${mes}/reabrir`, { motivo });
  }

  historico(mes: string) {
    return this.http.get<HistoricoPeriodo>(`${this.base}/periodos/${mes}/historico`);
  }

  revisao(mes: string, revisao: number, filtro: PaginacaoFiltro = {}) {
    return this.http.get<RevisaoPeriodo>(`${this.base}/periodos/${mes}/revisoes/${revisao}`, { params: montarParams(filtro) });
  }

  comparar(mes: string, de: number, para: number, filtro: PaginacaoFiltro = {}) {
    return this.http.get<ComparacaoRevisoes>(`${this.base}/periodos/${mes}/comparar`, { params: montarParams({ de, para, ...filtro }) });
  }

  baixarHistorico(mes: string, formato: FormatoArquivo) {
    return this.arquivo(`${this.base}/periodos/${mes}/historico`, { formato }, `historico-depreciacao-${mes}.${formato}`);
  }

  baixarComparacao(mes: string, de: number, para: number, formato: FormatoArquivo) {
    return this.arquivo(`${this.base}/periodos/${mes}/comparar`, { de, para, formato }, `comparacao-depreciacao-${mes}-rev${de}-rev${para}.${formato}`);
  }

  // --- Relatórios (4.3) ---

  razao(filtro: PaginacaoFiltro & { competencia: string; agrupar?: AgruparRazao; revisao?: number }) {
    return this.http.get<RelatorioRazao>(`${this.base}/relatorios/razao`, { params: montarParams(filtro) });
  }

  baixarRazao(filtro: { competencia: string; agrupar?: AgruparRazao; revisao?: number }, formato: FormatoArquivo) {
    return this.arquivo(`${this.base}/relatorios/razao`, { ...filtro, formato }, `razao-${filtro.competencia}.${formato}`);
  }

  valorContabil(filtro: FiltroValorContabil = {}) {
    return this.http.get<RelatorioValorContabil>(`${this.base}/relatorios/valor-contabil`, { params: montarParams(filtro) });
  }

  baixarValorContabil(filtro: FiltroValorContabil, formato: FormatoArquivo) {
    const { page, pageSize, ...semPaginacao } = filtro;
    void page; void pageSize;
    return this.arquivo(`${this.base}/relatorios/valor-contabil`, { ...semPaginacao, formato }, `valor-contabil.${formato}`);
  }

  bensPorDimensao(por: DimensaoRelatorio, em?: string) {
    return this.http.get<RelatorioBensPorDimensao>(`${this.base}/relatorios/bens-por-dimensao`, { params: montarParams({ por, em }) });
  }

  baixarBensPorDimensao(por: DimensaoRelatorio, em: string | undefined, formato: FormatoArquivo) {
    return this.arquivo(`${this.base}/relatorios/bens-por-dimensao`, { por, em, formato }, `bens-por-${por}.${formato}`);
  }

  baixas(filtro: PaginacaoFiltro & { de?: string; ate?: string } = {}) {
    return this.http.get<RelatorioBaixas>(`${this.base}/relatorios/baixas`, { params: montarParams(filtro) });
  }

  baixarBaixas(filtro: { de?: string; ate?: string }, formato: FormatoArquivo) {
    return this.arquivo(`${this.base}/relatorios/baixas`, { ...filtro, formato }, `baixas.${formato}`);
  }

  /** Download via HttpClient (o `X-Empresa-Id` não vai em link direto); nome vem do `Content-Disposition`. */
  private arquivo(url: string, params: object, nomePadrao: string): Observable<ArquivoExportado> {
    return this.http.get(url, { params: montarParams(params), responseType: 'blob', observe: 'response' }).pipe(
      map(res => ({
        blob: res.body as Blob,
        nome: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? nomePadrao
      })),
      catchError(erroDeBlob)
    );
  }
}
