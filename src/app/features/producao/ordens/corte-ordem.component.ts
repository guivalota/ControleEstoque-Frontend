import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdemProducaoService } from '../../../core/services/ordem-producao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { Corte, RegistrarCorteRequest } from '../../../core/models/corte-producao.model';
import { OrdemProducao } from '../../../core/models/ordem-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { formatarPercentual } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface LinhaCorte {
  variacaoId: number | null;
  rotulo: string;
  porCamada: number | null;
  cortadas: number | null;
}

/**
 * Corte da ordem: tecido puxado do estoque, retalho devolvido, camadas e peças cortadas por tamanho. Mostra o aproveitamento
 * (perda real × prevista pela ficha) e a perda de contagem (esperadas − cortadas). O tecido do corte é baixado do estoque
 * na hora (usado − retalho); o apontamento depois não baixa de novo.
 */
@Component({
  selector: 'app-corte-ordem',
  standalone: true,
  imports: [FormsModule, QtdPipe],
  template: `
    <h2 class="h6">Corte</h2>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (podeCortar()) {
      <div class="card card-body mb-3">
        <div class="row g-2 mb-2">
          <div class="col-12 col-md-4">
            <label class="form-label small mb-1" for="corte-material">Tecido</label>
            <select id="corte-material" class="form-select form-select-sm" [(ngModel)]="materialId">
              @for (m of ordem().materiais; track m.materialId) { <option [ngValue]="m.materialId">{{ m.materialNome }} ({{ m.unidadeCodigo }})</option> }
            </select>
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label small mb-1" for="corte-usado">Usado</label>
            <input id="corte-usado" class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="usado">
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label small mb-1" for="corte-retalho">Retalho devolvido</label>
            <input id="corte-retalho" class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="retalho">
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label small mb-1" for="corte-camadas">Camadas</label>
            <input id="corte-camadas" class="form-control form-control-sm" type="number" min="1" step="1" [(ngModel)]="camadas">
          </div>
        </div>
        @for (l of linhas; track $index) {
          <div class="row g-2 align-items-center mb-1">
            <div class="col-3 col-md-2"><strong>{{ l.rotulo }}</strong></div>
            <div class="col-4 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="por camada" [(ngModel)]="l.porCamada" [attr.aria-label]="'Por camada ' + l.rotulo"></div>
            <div class="col-5 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="cortadas" [(ngModel)]="l.cortadas" [attr.aria-label]="'Cortadas ' + l.rotulo"></div>
            <div class="col-12 col-md-4 small text-secondary">
              esperadas: {{ esperadas(l) | qtd }}
              @if (perdidas(l) > 0) { · <span class="text-danger">{{ perdidas(l) | qtd }} perdida(s)</span> }
            </div>
          </div>
        }
        <input class="form-control form-control-sm mt-2" maxlength="500" placeholder="Observações do corte" aria-label="Observações do corte" [(ngModel)]="observacao">
        <div class="mt-2">
          <button class="btn btn-primary btn-sm" [disabled]="salvando() || !podeSalvar()" (click)="registrar()">Registrar corte</button>
        </div>
      </div>
    }

    @if (cortes().length === 0) {
      <p class="small text-secondary">Nenhum corte registrado.</p>
    } @else {
      @for (c of cortes(); track c.id) {
        <div class="border rounded p-2 mb-2 small">
          <div>
            {{ c.criadoEm.slice(0, 10) }} · <strong>{{ c.materialNome }}</strong>: usado {{ c.usado | qtd }} {{ c.unidadeCodigo }}
            @if (c.retalho > 0) { · retalho {{ c.retalho | qtd }} } · consumido <strong>{{ c.consumido | qtd }}</strong> · {{ c.camadas }} camada(s)
            {{ c.usuarioNome ? ' · ' + c.usuarioNome : '' }}
          </div>
          <div>
            @for (i of c.itens; track $index) {
              <span class="me-3">{{ i.variacaoSku ?? 'Peças' }}: <strong>{{ i.cortadas | qtd }}</strong> de {{ i.esperadas | qtd }}
                @if (i.perdidas > 0) { <span class="text-danger">(−{{ i.perdidas | qtd }})</span> }</span>
            }
          </div>
          <div class="text-secondary">
            Aproveitamento {{ pct(c.aproveitamentoPercentual) }} · perda real {{ pct(c.perdaRealPercentual) }} × prevista {{ pct(c.perdaPrevistaPercentual) }}
            · {{ c.sobra >= 0 ? 'sobra de' : 'gastou a mais:' }} {{ abs(c.sobra) | qtd }} {{ c.unidadeCodigo }}
            @if (c.pecasPerdidas > 0) { · {{ c.pecasPerdidas | qtd }} peça(s) perdida(s) na contagem }
          </div>
        </div>
      }
    }
  `
})
export class CorteOrdemComponent {
  private service = inject(OrdemProducaoService);
  private toast = inject(ToastService);
  permissao = inject(PermissaoService);

  ordem = input.required<OrdemProducao>();
  registrado = output<void>();

  cortes = signal<Corte[]>([]);
  salvando = signal(false);
  erro = signal('');
  materialId: number | null = null;
  usado: number | null = null;
  retalho: number | null = null;
  camadas: number | null = null;
  observacao = '';
  linhas: LinhaCorte[] = [];

  constructor() {
    effect(() => {
      const o = this.ordem();
      this.materialId = o.materiais[0]?.materialId ?? null;
      this.linhas = o.itens.map(i => ({ variacaoId: i.variacaoId, rotulo: i.variacaoSku ?? 'Peças', porCamada: null, cortadas: null }));
      this.carregar();
    });
  }

  podeCortar() {
    const status = this.ordem().status;
    return this.permissao.canEdit() && (status === 'liberada' || status === 'em_producao');
  }

  pct(valor: number | null) {
    return valor === null ? '—' : formatarPercentual(valor);
  }

  abs(valor: number) {
    return Math.abs(valor);
  }

  esperadas(l: LinhaCorte) {
    return (Number(l.porCamada) || 0) * (Number(this.camadas) || 0);
  }

  perdidas(l: LinhaCorte) {
    return Math.max(this.esperadas(l) - (Number(l.cortadas) || 0), 0);
  }

  podeSalvar() {
    return !!this.materialId && Number(this.usado) > 0 && Number(this.camadas) >= 1 && this.linhas.some(l => Number(l.cortadas) > 0);
  }

  private carregar() {
    this.service.cortes(this.ordem().id).subscribe({ next: c => this.cortes.set(c), error: () => this.cortes.set([]) });
  }

  registrar() {
    this.salvando.set(true);
    this.erro.set('');
    const req: RegistrarCorteRequest = {
      materialId: this.materialId!, usado: Number(this.usado), retalho: Number(this.retalho) || 0, camadas: Number(this.camadas),
      observacao: this.observacao.trim() || null,
      itens: this.linhas.filter(l => Number(l.cortadas) > 0 || Number(l.porCamada) > 0)
        .map(l => ({ variacaoId: l.variacaoId, porCamada: Number(l.porCamada) || 0, cortadas: Number(l.cortadas) || 0 }))
    };
    this.service.registrarCorte(this.ordem().id, req).subscribe({
      next: () => {
        this.salvando.set(false);
        this.usado = null; this.retalho = null; this.camadas = null; this.observacao = '';
        this.linhas.forEach(l => { l.porCamada = null; l.cortadas = null; });
        this.toast.sucesso('Corte registrado: tecido baixado do estoque.');
        this.registrado.emit();
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível registrar o corte.'), 'Não foi possível registrar o corte.'));
      }
    });
  }
}
