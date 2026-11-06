import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { erroDeBlob } from '../utils/erro-blob';
import { montarParams } from '../utils/http-params';
import {
  AjustesImportacao, FiltroFluxo, FiltroRelatorioFin, FinConfiguracao, FluxoCaixa, Importacao, NomeRelatorioFin,
  RelatorioTabela, SalvarFinConfiguracao, SituacaoImportacao
} from '../models/financeiro-relatorios.model';

/** Fluxo de caixa, relatórios, configurações e importações do Financeiro. Stateless. */
@Injectable({ providedIn: 'root' })
export class FinanceiroRelatoriosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/financeiro`;

  fluxoCaixa(filtro: FiltroFluxo) {
    return this.http.get<FluxoCaixa>(`${this.base}/fluxo-caixa`, { params: montarParams(filtro) });
  }

  relatorio(nome: NomeRelatorioFin, filtro: FiltroRelatorioFin) {
    return this.http.get<RelatorioTabela>(`${this.base}/relatorios/${nome}`, { params: montarParams(filtro) });
  }

  /** Arquivo do relatório (exige `financeiro.relatorios.exportar`). */
  exportar(nome: NomeRelatorioFin, formato: 'csv' | 'pdf', filtro: FiltroRelatorioFin) {
    return this.http.get(`${this.base}/relatorios/${nome}/exportar`, { params: montarParams({ ...filtro, formato }), responseType: 'blob' })
      .pipe(catchError(erroDeBlob));
  }

  configuracao() {
    return this.http.get<FinConfiguracao>(`${this.base}/configuracoes`);
  }

  salvarConfiguracao(req: SalvarFinConfiguracao) {
    return this.http.put<FinConfiguracao>(`${this.base}/configuracoes`, req);
  }

  importacoes(situacao?: SituacaoImportacao) {
    return this.http.get<Importacao[]>(`${this.base}/importacoes`, { params: montarParams({ situacao }) });
  }

  confirmarImportacao(id: number, ajustes?: AjustesImportacao) {
    return this.http.post<void>(`${this.base}/importacoes/${id}/confirmar`, ajustes ?? {});
  }

  descartarImportacao(id: number) {
    return this.http.post<void>(`${this.base}/importacoes/${id}/descartar`, {});
  }
}
