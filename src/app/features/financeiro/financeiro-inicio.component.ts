import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { PermissaoService } from '../../core/services/permissao.service';
import { FinanceiroRelatoriosService } from '../../core/services/financeiro-relatorios.service';
import { AprovacaoService } from '../../core/services/aprovacao.service';
import { hojeIso, mesAtual, ultimoDiaDoMes } from '../../core/utils/financeiro-datas';
import { formatarMoeda } from '../../core/utils/imob-formato';

interface Bloco<T> { carregando: boolean; erro: boolean; dados: T | null; }
interface Resumo { quantidade: number; saldo: number; }
interface SaldoMes { projetado: number; realizado: number; }

const vazio = <T,>(): Bloco<T> => ({ carregando: true, erro: false, dados: null });

/**
 * Painel do Financeiro (US-24-07): a vencer em 7 dias, vencidos, saldo previsto do mês e atalhos. Cada bloco busca os próprios dados
 * e falha sozinho — um erro (ou a falta de permissão) em um bloco não derruba os outros.
 */
@Component({
  selector: 'app-financeiro-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1 class="h4 mb-3">Financeiro</h1>

    <div class="row g-3 mb-4">
      @if (permissao.pode('financeiro.relatorios.ver')) {
        <div class="col-12 col-md-4">
          <div class="card card-body h-100">
            <h2 class="h6 text-secondary">A vencer nos próximos 7 dias</h2>
            @if (aVencer().carregando) { <p class="text-secondary mb-0">Carregando…</p> }
            @else if (aVencer().erro) { <p class="text-danger mb-0" role="alert">Não foi possível carregar.</p> }
            @else if (aVencer().dados) {
              @let d = aVencer().dados!;
              <strong class="fs-4">{{ moeda(d.saldo) }}</strong>
              <span class="small text-secondary">{{ d.quantidade }} título(s)</span>
              <a class="small mt-2" routerLink="/financeiro/titulos" [queryParams]="{ vencimentoDe: hoje, vencimentoAte: daqui7 }">Ver títulos</a>
            }
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card card-body h-100" [class.border-danger]="(vencidos().dados?.quantidade ?? 0) > 0">
            <h2 class="h6 text-secondary">Vencidos</h2>
            @if (vencidos().carregando) { <p class="text-secondary mb-0">Carregando…</p> }
            @else if (vencidos().erro) { <p class="text-danger mb-0" role="alert">Não foi possível carregar.</p> }
            @else if (vencidos().dados) {
              @let d = vencidos().dados!;
              <strong class="fs-4" [class.text-danger]="d.quantidade > 0">{{ moeda(d.saldo) }}</strong>
              <span class="small text-secondary">{{ d.quantidade }} título(s) em atraso</span>
              <a class="small mt-2" routerLink="/financeiro/titulos" [queryParams]="{ status: 'vencido' }">Ver vencidos</a>
            }
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card card-body h-100">
            <h2 class="h6 text-secondary">Saldo previsto do mês</h2>
            @if (saldoMes().carregando) { <p class="text-secondary mb-0">Carregando…</p> }
            @else if (saldoMes().erro) { <p class="text-danger mb-0" role="alert">Não foi possível carregar.</p> }
            @else if (saldoMes().dados) {
              @let d = saldoMes().dados!;
              <strong class="fs-4" [class.text-danger]="d.projetado < 0">{{ moeda(d.projetado) }}</strong>
              <span class="small text-secondary">Hoje nas contas (realizado): {{ moeda(d.realizado) }}</span>
              <a class="small mt-2" routerLink="/financeiro/fluxo-caixa">Abrir o fluxo de caixa</a>
            }
          </div>
        </div>
      }
    </div>

    @if (permissao.pode('core.aprovacoes.ver') || permissao.pode('financeiro.importacoes.gerenciar')) {
      <div class="row g-3 mb-4">
        @if (permissao.pode('core.aprovacoes.ver')) {
          <div class="col-12 col-md-6">
            <a class="card card-body text-decoration-none h-100" routerLink="/aprovacoes">
              <strong><i class="bi bi-check2-square me-2"></i>Aprovações pendentes</strong>
              @if (aprovacoes().carregando) { <span class="small text-secondary">Carregando…</span> }
              @else if (aprovacoes().erro) { <span class="small text-danger">Não foi possível carregar.</span> }
              @else { <span class="small text-secondary">{{ aprovacoes().dados ?? 0 }} pedido(s) aguardando decisão.</span> }
            </a>
          </div>
        }
        @if (permissao.pode('financeiro.importacoes.gerenciar')) {
          <div class="col-12 col-md-6">
            <a class="card card-body text-decoration-none h-100" routerLink="/financeiro/importacoes">
              <strong><i class="bi bi-box-arrow-in-down me-2"></i>Importações pendentes</strong>
              @if (importacoes().carregando) { <span class="small text-secondary">Carregando…</span> }
              @else if (importacoes().erro) { <span class="small text-danger">Não foi possível carregar.</span> }
              @else { <span class="small text-secondary">{{ importacoes().dados ?? 0 }} lançamento(s) do Estoque ou da Produção aguardando importação.</span> }
            </a>
          </div>
        }
      </div>
    }

    <h2 class="h6">Atalhos</h2>
    <div class="d-flex flex-wrap gap-2">
      @if (permissao.pode('financeiro.titulos.criar')) {
        <a class="btn btn-primary btn-sm" routerLink="/financeiro/titulos/novo" [queryParams]="{ tipo: 'pagar' }">Novo título a pagar</a>
        <a class="btn btn-primary btn-sm" routerLink="/financeiro/titulos/novo" [queryParams]="{ tipo: 'receber' }">Novo título a receber</a>
      }
      @if (permissao.pode('financeiro.titulos.ver')) {
        <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/titulos">Títulos</a>
        <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/contas-fixas">Contas fixas</a>
      }
      @if (permissao.pode('financeiro.relatorios.ver')) {
        <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/fluxo-caixa">Fluxo de caixa</a>
        <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/relatorios">Relatórios</a>
      }
      @if (permissao.pode('financeiro.cadastros.ver')) { <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/cadastros">Cadastros</a> }
      <a class="btn btn-outline-primary btn-sm" routerLink="/manual/financeiro">Manual do Financeiro</a>
    </div>
  `
})
export class FinanceiroInicioComponent implements OnInit {
  permissao = inject(PermissaoService);
  private relatorios = inject(FinanceiroRelatoriosService);
  private aprovacoesService = inject(AprovacaoService);

  readonly hoje = hojeIso();
  readonly daqui7 = hojeIso(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 6));

  aVencer = signal<Bloco<Resumo>>(vazio());
  vencidos = signal<Bloco<Resumo>>(vazio());
  saldoMes = signal<Bloco<SaldoMes>>(vazio());
  aprovacoes = signal<Bloco<number>>(vazio());
  importacoes = signal<Bloco<number>>(vazio());

  ngOnInit() {
    if (this.permissao.pode('financeiro.relatorios.ver')) {
      const d = new Date();
      const em7 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
      const ate = hojeIso(em7);
      const ontem = hojeIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
      const inicioVencidos = hojeIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 365));

      this.carregar(this.aVencer, this.relatorios.relatorio('vencimentos', { de: this.hoje, ate }), t => ({
        quantidade: t.linhas.length, saldo: Number(t.totais?.[7] ?? 0)
      }));
      this.carregar(this.vencidos, this.relatorios.relatorio('vencimentos', { de: inicioVencidos, ate: ontem }), t => ({
        quantidade: t.linhas.length, saldo: Number(t.totais?.[7] ?? 0)
      }));
      const mes = mesAtual();
      this.carregar(this.saldoMes, this.relatorios.fluxoCaixa({ de: `${mes}-01`, ate: ultimoDiaDoMes(mes), agrupar: 'mes' }), f => ({
        projetado: f.periodos[0]?.saldoProjetado ?? 0, realizado: f.periodos[0]?.saldoRealizado ?? 0
      }));
    }
    if (this.permissao.pode('core.aprovacoes.ver')) this.carregar(this.aprovacoes, this.aprovacoesService.listar('pendente', 1, 1), r => r.total);
    if (this.permissao.pode('financeiro.importacoes.gerenciar')) this.carregar(this.importacoes, this.relatorios.importacoes(), l => l.length);
  }

  /** Cada bloco carrega sozinho: erro em um só marca aquele bloco. */
  private carregar<T, R>(alvo: { set(v: Bloco<R>): void }, origem: Observable<T>, mapear: (v: T) => R) {
    origem.subscribe({
      next: v => alvo.set({ carregando: false, erro: false, dados: mapear(v) }),
      error: () => alvo.set({ carregando: false, erro: true, dados: null })
    });
  }

  moeda(v: number) { return formatarMoeda(v); }
}
