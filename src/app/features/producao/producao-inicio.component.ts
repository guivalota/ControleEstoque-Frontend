import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RelatorioProducaoService } from '../../core/services/relatorio-producao.service';
import { DashboardProducao } from '../../core/models/relatorio-producao.model';
import { ROTULO_STATUS_ORDEM, StatusOrdemProducao } from '../../core/models/ordem-producao.model';
import { QtdPipe } from '../../core/pipes/qtd.pipe';
import { formatarData } from '../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../core/utils/erros-api';

/** Painel da Produção: ordens por estado, atrasadas, materiais a comprar e a situação da terceirização. */
@Component({
  selector: 'app-producao-inicio',
  standalone: true,
  imports: [RouterLink, QtdPipe],
  template: `
    <h1 class="h4 mb-3">Produção</h1>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (painel(); as p) {
      <h2 class="h6">Ordens</h2>
      <div class="row g-2 mb-3">
        @for (e of p.ordensPorEstado; track e.status) {
          <div class="col-6 col-md-2">
            <a class="card card-body py-2 text-decoration-none" [routerLink]="['/producao/ordens']" [queryParams]="{ status: e.status }">
              <small class="text-secondary">{{ rotulo(e.status) }}</small><strong class="fs-4">{{ e.quantidade }}</strong>
            </a>
          </div>
        }
      </div>
      <p class="small text-secondary">Concluídas e canceladas: últimos 30 dias.</p>

      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <div class="card card-body h-100" [class.border-danger]="p.ordensAtrasadas > 0">
            <h2 class="h6">Ordens atrasadas: {{ p.ordensAtrasadas }}</h2>
            @for (o of p.maisAtrasadas; track o.ordemId) {
              <div class="small"><a [routerLink]="['/producao/ordens', o.ordemId]">Ordem {{ o.numero }}</a> · {{ o.produtoNome }} ·
                <span class="text-danger">{{ o.diasDeAtraso }} dia(s)</span> (prazo {{ data(o.prazo) }})</div>
            } @empty { <span class="small text-secondary">Nenhuma ordem passou do prazo.</span> }
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card card-body h-100" [class.border-warning]="p.materiaisAComprar > 0">
            <h2 class="h6">Materiais a comprar: {{ p.materiaisAComprar }}</h2>
            @for (m of p.materiaisPrioritarios; track m.materialId) {
              <div class="small">{{ m.materialNome }}: <strong>{{ m.aComprar | qtd }} {{ m.unidadeCodigo }}</strong>
                @if (m.atrasada) { <span class="badge text-bg-danger">comprar já</span> }</div>
            } @empty { <span class="small text-secondary">O estoque cobre as ordens abertas.</span> }
            <a class="small mt-2" routerLink="/producao/necessidade-materiais">Ver necessidade de materiais</a>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card card-body h-100" [class.border-danger]="p.remessasAtrasadas > 0">
            <h2 class="h6">Terceirização</h2>
            <div class="small">{{ p.remessasAbertas }} remessa(s) em aberto · {{ p.pecasEmPoderDeOficinas | qtd }} peça(s) nos terceirizados</div>
            @if (p.remessasAtrasadas > 0) { <div class="small text-danger">{{ p.remessasAtrasadas }} remessa(s) atrasada(s)</div> }
            <a class="small mt-2" routerLink="/producao/faccao">Ver terceirização</a>
          </div>
        </div>
      </div>
    } @else if (!erro()) {
      <p class="text-secondary">Carregando…</p>
    }
  `
})
export class ProducaoInicioComponent implements OnInit {
  private service = inject(RelatorioProducaoService);

  painel = signal<DashboardProducao | null>(null);
  erro = signal('');

  ngOnInit() {
    this.service.dashboard().subscribe({
      next: p => this.painel.set(p),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar o painel.'), 'Não foi possível carregar o painel.'))
    });
  }

  rotulo(status: string) {
    return ROTULO_STATUS_ORDEM[status as StatusOrdemProducao] ?? status;
  }

  data(iso: string) {
    return formatarData(iso);
  }
}
