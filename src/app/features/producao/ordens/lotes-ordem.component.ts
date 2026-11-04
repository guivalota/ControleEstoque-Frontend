import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RastreioLoteService } from '../../../core/services/rastreio-lote.service';
import { OrdemLotes } from '../../../core/models/rastreio-lote.model';
import { OrdemProducao } from '../../../core/models/ordem-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';

/** Rastreabilidade da ordem: de quais lotes saiu o material e em quais lotes entrou o acabado. Só aparece quando há lote. */
@Component({
  selector: 'app-lotes-ordem',
  standalone: true,
  imports: [RouterLink, QtdPipe],
  template: `
    @if (lotes(); as l) {
      @if (l.consumidos.length > 0 || l.gerados.length > 0) {
        <h2 class="h6">Rastreabilidade</h2>
        <ul class="small">
          @for (c of l.consumidos; track $index) {
            <li>{{ c.materialNome }}: <a [routerLink]="['/producao/rastreio/lote', c.loteId]">lote {{ c.numeroLote }}</a> — {{ c.quantidade | qtd }} {{ c.unidadeCodigo }}</li>
          }
          @for (g of l.gerados; track g.loteId) {
            <li>Acabado {{ g.produtoSku }}: <a [routerLink]="['/producao/rastreio/lote', g.loteId]">lote {{ g.numeroLote }}</a> — {{ g.quantidade | qtd }} peça(s)</li>
          }
        </ul>
      }
    }
  `
})
export class LotesOrdemComponent {
  private service = inject(RastreioLoteService);

  ordem = input.required<OrdemProducao>();
  lotes = signal<OrdemLotes | null>(null);

  constructor() {
    effect(() => {
      // recarrega a cada novo valor da ordem (novo corte/apontamento/retorno devolve a ordem atualizada)
      const id = this.ordem().id;
      this.service.daOrdem(id).subscribe({ next: l => this.lotes.set(l), error: () => this.lotes.set(null) });
    });
  }
}
