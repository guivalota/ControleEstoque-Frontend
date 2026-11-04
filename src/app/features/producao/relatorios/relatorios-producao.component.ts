import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RelatorioProducaoService, RelatorioProducaoTipo } from '../../../core/services/relatorio-producao.service';
import { CustoOrdens, ProducaoPeriodo } from '../../../core/models/relatorio-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { baixarBlob } from '../../../core/utils/download';
import { formatarData, formatarMoeda, formatarPercentual } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/** Relatórios da Produção: custo real × padrão por ordem concluída e produção por período (com perda de tecido e atrasos). */
@Component({
  selector: 'app-relatorios-producao',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <h1 class="h4 mb-3">Relatórios de produção</h1>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><button class="nav-link" [class.active]="aba() === 'custo-ordens'" (click)="trocar('custo-ordens')">Custo real × padrão</button></li>
      <li class="nav-item"><button class="nav-link" [class.active]="aba() === 'producao'" (click)="trocar('producao')">Produção e perdas</button></li>
    </ul>

    <div class="row g-2 mb-3 align-items-end">
      <div class="col-6 col-md-2"><label class="form-label small mb-1" for="de">De</label><input id="de" class="form-control form-control-sm" type="date" [(ngModel)]="de"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-1" for="ate">Até</label><input id="ate" class="form-control form-control-sm" type="date" [(ngModel)]="ate"></div>
      <div class="col-12 col-md-auto d-flex gap-2">
        <button class="btn btn-primary btn-sm" [disabled]="carregando()" (click)="carregar()">Consultar</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="exportar('csv')">CSV</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="exportar('pdf')">PDF</button>
      </div>
    </div>

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else if (aba() === 'custo-ordens' && custo()) {
      @let c = custo()!;
      <p class="small text-secondary">Ordens concluídas de {{ data(c.de) }} a {{ data(c.ate) }}. Real = insumos + mão de obra própria + indiretos + terceirização.</p>
      @if (c.ordens.length === 0) {
        <p class="text-secondary">Nenhuma ordem concluída no período.</p>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr><th>Ordem</th><th>Produto</th><th class="text-end">Peças</th><th class="text-end">Padrão</th><th class="text-end">Insumos</th>
                <th class="text-end">Mão de obra</th><th class="text-end">Indiretos</th><th class="text-end">Terceirização</th><th class="text-end">Real</th><th class="text-end">Diferença</th></tr>
            </thead>
            <tbody>
              @for (o of c.ordens; track o.ordemId) {
                <tr>
                  <td><a [routerLink]="['/producao/ordens', o.ordemId]">{{ o.numero }}</a></td>
                  <td>{{ o.produtoSku }} — {{ o.produtoNome }}</td>
                  <td class="text-end">{{ o.pecas | qtd }}</td>
                  <td class="text-end">{{ o.custoPadrao === null ? '—' : moeda(o.custoPadrao) }}</td>
                  <td class="text-end">{{ moeda(o.insumos) }}</td>
                  <td class="text-end">{{ moeda(o.maoDeObra) }}</td>
                  <td class="text-end">{{ moeda(o.custosIndiretos) }}</td>
                  <td class="text-end">{{ moeda(o.faccao) }}</td>
                  <td class="text-end"><strong>{{ moeda(o.custoReal) }}</strong></td>
                  <td class="text-end" [class.text-danger]="(o.diferenca ?? 0) > 0" [class.text-success]="(o.diferenca ?? 0) < 0">
                    {{ o.diferenca === null ? '—' : moeda(o.diferenca) + ' (' + pct(o.diferencaPercentual) + ')' }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr><th colspan="3">Total</th><th class="text-end">{{ moeda(c.totalPadrao) }}</th><th colspan="4"></th>
                <th class="text-end">{{ moeda(c.totalReal) }}</th><th class="text-end">{{ moeda(c.totalDiferenca) }}</th></tr>
            </tfoot>
          </table>
        </div>
        @if (c.ordensSemCustoPadrao > 0) {
          <p class="small text-warning-emphasis">{{ c.ordensSemCustoPadrao }} ordem(ns) sem custo padrão (faltava custo de algum material na ficha) ficam fora da diferença.</p>
        }
      }
    } @else if (aba() === 'producao' && producao()) {
      @let p = producao()!;
      <p class="small text-secondary">Peças boas apontadas de {{ data(p.de) }} a {{ data(p.ate) }}: <strong>{{ p.totalPecas | qtd }}</strong>.</p>
      @if (p.produtos.length === 0) {
        <p class="text-secondary">Nada foi apontado no período.</p>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>SKU</th><th>Produto</th><th class="text-end">Peças boas</th><th class="text-end">Apont. com sobreprodução</th></tr></thead>
            <tbody>
              @for (x of p.produtos; track x.produtoId) {
                <tr><td>{{ x.produtoSku }}</td><td>{{ x.produtoNome }}</td><td class="text-end">{{ x.quantidade | qtd }}</td><td class="text-end">{{ x.apontamentosComSobreproducao }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <h2 class="h6 mt-3">Perda de tecido nos cortes</h2>
      @if (p.perdaDeTecido.length === 0) {
        <p class="small text-secondary">Nenhum corte no período.</p>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>Material</th><th class="text-end">Cortes</th><th class="text-end">Consumido</th><th class="text-end">Teórico</th>
              <th class="text-end">Perda real</th><th class="text-end">Perda prevista</th><th class="text-end">Aproveitamento</th></tr></thead>
            <tbody>
              @for (m of p.perdaDeTecido; track m.materialId) {
                <tr><td>{{ m.materialNome }}</td><td class="text-end">{{ m.cortes }}</td><td class="text-end">{{ m.consumido | qtd }} {{ m.unidadeCodigo }}</td>
                  <td class="text-end">{{ m.consumoTeorico | qtd }}</td><td class="text-end">{{ pct(m.perdaRealPercentual) }}</td>
                  <td class="text-end">{{ pct(m.perdaPrevistaPercentual) }}</td><td class="text-end">{{ pct(m.aproveitamentoPercentual) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <h2 class="h6 mt-3">Ordens atrasadas hoje</h2>
      @for (o of p.ordensAtrasadas; track o.ordemId) {
        <div class="small"><a [routerLink]="['/producao/ordens', o.ordemId]">Ordem {{ o.numero }}</a> · {{ o.produtoNome }} ·
          <span class="text-danger">{{ o.diasDeAtraso }} dia(s) de atraso</span></div>
      } @empty { <span class="small text-secondary">Nenhuma.</span> }
    }
  `
})
export class RelatoriosProducaoComponent implements OnInit {
  private service = inject(RelatorioProducaoService);

  aba = signal<RelatorioProducaoTipo>('custo-ordens');
  custo = signal<CustoOrdens | null>(null);
  producao = signal<ProducaoPeriodo | null>(null);
  carregando = signal(false);
  erro = signal('');
  de = '';
  ate = '';

  ngOnInit() {
    this.carregar();
  }

  moeda(valor: number) {
    return formatarMoeda(valor);
  }

  pct(valor: number | null) {
    return valor === null ? '—' : formatarPercentual(valor);
  }

  data(iso: string) {
    return formatarData(iso);
  }

  trocar(aba: RelatorioProducaoTipo) {
    this.aba.set(aba);
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set('');
    const falha = (err: unknown) => {
      this.carregando.set(false);
      this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar o relatório.'), 'Não foi possível carregar o relatório.'));
    };
    if (this.aba() === 'custo-ordens') {
      this.service.custoOrdens(this.de || undefined, this.ate || undefined).subscribe({ next: r => { this.custo.set(r); this.carregando.set(false); }, error: falha });
    } else {
      this.service.producao(this.de || undefined, this.ate || undefined).subscribe({ next: r => { this.producao.set(r); this.carregando.set(false); }, error: falha });
    }
  }

  exportar(formato: 'csv' | 'pdf') {
    this.erro.set('');
    this.service.exportar(this.aba(), formato, this.de || undefined, this.ate || undefined).subscribe({
      next: blob => baixarBlob(blob, `${this.aba()}.${formato}`),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível exportar o relatório.'), 'Não foi possível exportar o relatório.'))
    });
  }
}
