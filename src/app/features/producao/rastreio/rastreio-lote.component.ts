import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RastreioLoteService } from '../../../core/services/rastreio-lote.service';
import { RastreioLote } from '../../../core/models/rastreio-lote.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { formatarData } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/** Rastreio de um lote nos dois sentidos: rolo de tecido → ordens → lotes de acabado, e o lote de acabado → ordem → rolos usados. */
@Component({
  selector: 'app-rastreio-lote',
  standalone: true,
  imports: [RouterLink, QtdPipe],
  template: `
    <a routerLink="/lotes" class="small">← Lotes</a>
    @if (rastreio(); as r) {
      <h1 class="h4 mt-1 mb-1">Rastreio do lote {{ r.lote.numeroLote }}</h1>
      <p class="text-secondary small">
        {{ r.lote.produtoSku }} — {{ r.lote.produtoNome }} · saldo no lote {{ r.lote.quantidadeAtual | qtd }} {{ r.lote.unidadeCodigo }}
        @if (r.lote.dataValidade) { · validade {{ data(r.lote.dataValidade) }} }
      </p>

      @if (r.usadoEm.length === 0 && r.geradoPor.length === 0) {
        <p class="text-secondary">Este lote ainda não foi usado nem gerado por nenhuma ordem de produção.</p>
      }

      @if (r.usadoEm.length > 0) {
        <h2 class="h6">Usado nas ordens (para a frente)</h2>
        @for (o of r.usadoEm; track o.ordemId) {
          <div class="border rounded p-2 mb-2 small">
            <a [routerLink]="['/producao/ordens', o.ordemId]">Ordem {{ o.numero }}</a> · {{ o.produtoNome }} · consumiu
            <strong>{{ o.quantidade | qtd }} {{ r.lote.unidadeCodigo }}</strong>
            @if (o.lotesGerados.length > 0) {
              <div class="text-secondary">
                Gerou os lotes:
                @for (g of o.lotesGerados; track g.loteId) {
                  <a class="me-2" [routerLink]="['/producao/rastreio/lote', g.loteId]">{{ g.numeroLote }} ({{ g.produtoSku }}: {{ g.quantidade | qtd }})</a>
                }
              </div>
            }
          </div>
        }
      }

      @if (r.geradoPor.length > 0) {
        <h2 class="h6">Gerado pela ordem (para trás)</h2>
        @for (o of r.geradoPor; track o.ordemId) {
          <div class="border rounded p-2 mb-2 small">
            <a [routerLink]="['/producao/ordens', o.ordemId]">Ordem {{ o.numero }}</a> · {{ o.produtoNome }} · gerou
            <strong>{{ o.quantidade | qtd }}</strong> peça(s) neste lote
            @if (o.lotesConsumidos.length > 0) {
              <div class="text-secondary">
                Material usado:
                @for (c of o.lotesConsumidos; track $index) {
                  <a class="me-2" [routerLink]="['/producao/rastreio/lote', c.loteId]">{{ c.materialNome }} · {{ c.numeroLote }} ({{ c.quantidade | qtd }} {{ c.unidadeCodigo }})</a>
                }
              </div>
            }
          </div>
        }
      }
    } @else if (erro()) {
      <div class="alert alert-danger mt-2" role="alert">{{ erro() }}</div>
    } @else {
      <p class="text-secondary mt-2">Carregando…</p>
    }
  `
})
export class RastreioLoteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(RastreioLoteService);

  rastreio = signal<RastreioLote | null>(null);
  erro = signal('');

  ngOnInit() {
    // a página navega entre lotes ligados (mesma rota, outro id): reage à mudança do parâmetro
    this.route.paramMap.subscribe(p => this.carregar(Number(p.get('id'))));
  }

  data(iso: string) {
    return formatarData(iso);
  }

  private carregar(id: number) {
    this.rastreio.set(null);
    this.erro.set('');
    this.service.rastrear(id).subscribe({
      next: r => this.rastreio.set(r),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Lote não encontrado.'), 'Lote não encontrado.'))
    });
  }
}
