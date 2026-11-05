import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermissaoService } from '../../../core/services/permissao.service';
import { PrecificacaoService } from '../../../core/services/precificacao.service';
import { ToastService } from '../../../core/services/toast.service';
import { Precificacao } from '../../../core/models/precificacao.model';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Preço mínimo sugerido do produto: custo da ficha vigente ÷ (1 − (margem + despesas de venda) / 100), comparado ao preço de venda
 * do cadastro. É só uma referência; o preço de venda continua sendo o do produto.
 */
@Component({
  selector: 'app-precificacao-produto',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2 class="h6">Preço mínimo sugerido</h2>
    @if (erro()) { <div class="alert alert-danger small py-2" role="alert">{{ erro() }}</div> }
    @if (dados(); as p) {
      <p class="small text-secondary mb-2">
        Custo da ficha (custo médio de hoje) ÷ (1 − margem − despesas de venda). Despesas de venda: impostos, comissão e outros custos que saem do preço.
      </p>
      <div class="row g-2 align-items-end mb-2">
        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="margem">Margem desejada (%)</label>
          <input id="margem" class="form-control form-control-sm" type="number" min="0" max="99.99" step="any" [(ngModel)]="margem" [disabled]="!permissao.canEdit()">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="despesas">Despesas de venda (%)</label>
          <input id="despesas" class="form-control form-control-sm" type="number" min="0" max="99.99" step="any" [(ngModel)]="despesas" [disabled]="!permissao.canEdit()">
        </div>
        @if (permissao.canEdit()) {
          <div class="col-auto">
            <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="salvando()" (click)="salvar()">Salvar e recalcular</button>
          </div>
        }
      </div>

      @if (p.variacoes.length > 0) {
        <div class="table-responsive">
          <table class="table table-sm align-middle small">
            <thead><tr><th>Variação</th><th class="text-end">Custo por peça</th><th class="text-end">Preço mínimo</th><th class="text-end">Preço de venda</th><th class="text-end">Margem atual</th><th></th></tr></thead>
            <tbody>
              @for (v of p.variacoes; track v.variacaoId) {
                <tr>
                  <td>{{ v.sku }}</td>
                  <td class="text-end">{{ v.custoUnitario === null ? 'sem custo' : moeda(v.custoUnitario) }}</td>
                  <td class="text-end"><strong>{{ v.precoMinimoSugerido === null ? '—' : moeda(v.precoMinimoSugerido) }}</strong></td>
                  <td class="text-end">{{ v.precoVenda > 0 ? moeda(v.precoVenda) : 'não informado' }}</td>
                  <td class="text-end">{{ v.margemAtualPercentual === null ? '—' : v.margemAtualPercentual + '%' }}</td>
                  <td>@if (v.abaixoDoMinimo) { <span class="badge text-bg-warning">abaixo do mínimo</span> }</td>
                </tr>
                @if (v.materiaisSemCusto.length > 0) {
                  <tr><td colspan="6" class="text-warning">Sem custo conhecido para: {{ v.materiaisSemCusto.join(', ') }}.</td></tr>
                }
              }
            </tbody>
          </table>
        </div>
        <p class="small text-secondary">Calculado por variação, porque o consumo de material pode mudar de uma para outra (ex.: o couro de cada cor).</p>
      } @else if (p.precoMinimoSugerido !== null) {
        <ul class="list-unstyled small mb-1">
          <li>Custo por peça: <strong>{{ moeda(p.custoUnitario) }}</strong></li>
          <li>Preço mínimo sugerido: <strong>{{ moeda(p.precoMinimoSugerido) }}</strong></li>
          <li>Preço de venda cadastrado: <strong>{{ p.precoVenda > 0 ? moeda(p.precoVenda) : 'não informado' }}</strong>
            @if (p.margemAtualPercentual !== null) { · margem atual de {{ p.margemAtualPercentual }}% }
          </li>
        </ul>
        @if (p.abaixoDoMinimo) {
          <div class="alert alert-warning small py-2" role="alert">
            O preço de venda cadastrado está abaixo do mínimo sugerido: com ele a margem desejada não é atingida.
          </div>
        }
      } @else if (!p.temFicha) {
        <p class="small text-secondary">O produto ainda não tem ficha técnica.</p>
      } @else {
        <div class="alert alert-warning small py-2" role="alert">
          Sem custo conhecido para: {{ p.materiaisSemCusto.join(', ') }}. O preço mínimo só aparece quando todos os materiais tiverem custo.
        </div>
      }
    }
  `
})
export class PrecificacaoProdutoComponent {
  private service = inject(PrecificacaoService);
  private toast = inject(ToastService);
  permissao = inject(PermissaoService);

  produtoId = input.required<number>();
  /** Muda quando a ficha vigente muda (nova versão), para recalcular o custo. */
  fichaId = input<number | null>(null);

  dados = signal<Precificacao | null>(null);
  salvando = signal(false);
  erro = signal('');
  margem = 0;
  despesas = 0;

  constructor() {
    effect(() => {
      this.produtoId();
      this.fichaId();
      untracked(() => this.carregar());
    });
  }

  moeda(valor: number | null) {
    return valor === null ? '—' : MOEDA.format(valor);
  }

  salvar() {
    this.salvando.set(true);
    this.erro.set('');
    this.service.definir(this.produtoId(), Number(this.margem) || 0, Number(this.despesas) || 0).subscribe({
      next: p => {
        this.salvando.set(false);
        this.definir(p);
        this.toast.sucesso('Margem salva.');
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível salvar a margem.'), 'Não foi possível salvar a margem.'));
      }
    });
  }

  private carregar() {
    this.service.obter(this.produtoId()).subscribe({
      next: p => this.definir(p),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível calcular o preço mínimo.'), 'Não foi possível calcular o preço mínimo.'))
    });
  }

  private definir(p: Precificacao) {
    this.dados.set(p);
    this.margem = p.margemPercentual;
    this.despesas = p.despesasVendaPercentual;
  }
}
