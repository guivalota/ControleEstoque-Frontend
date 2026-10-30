import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaEventoService } from '../../../core/services/plataforma-evento.service';
import { LogSistema } from '../../../core/models/plataforma-evento.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { AVISO_INTERVALO_INVERTIDO, fimDoDiaLocalISO, inicioDoDiaLocalISO, intervaloInvertido } from '../../../core/utils/periodo';

const PAGE_SIZE = 50;
const NIVEIS = ['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal'];

/** Aba "Logs do sistema": GET v1/plataforma/logs (filtros dataInicio, dataFim, nivel; sem empresa/usuário). */

@Component({
  selector: 'app-logs-sistema',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-2">
            <label for="lsNivel" class="form-label small mb-1">Nível</label>
            <select id="lsNivel" class="form-select form-select-sm" [(ngModel)]="nivel">
              <option value="">Todos</option>
              @for (n of niveis; track n) { <option [value]="n">{{ n }}</option> }
            </select>
          </div>
          <div class="col-md-2">
            <label for="lsIni" class="form-label small mb-1">Data início</label>
            <input id="lsIni" type="date" class="form-control form-control-sm" [(ngModel)]="dataInicio">
          </div>
          <div class="col-md-2">
            <label for="lsFim" class="form-label small mb-1">Data fim</label>
            <input id="lsFim" type="date" class="form-control form-control-sm" [(ngModel)]="dataFim">
          </div>
          @if (periodoInvertido()) {
            <div class="col-12"><div class="text-warning-emphasis small" role="alert"><i class="bi bi-exclamation-triangle me-1"></i>{{ avisoPeriodo }}</div></div>
          }
          <div class="col-md-4 d-flex gap-2">
            <button type="button" class="btn btn-primary btn-sm" (click)="carregar(1)" [disabled]="loading()">
              <i class="bi bi-funnel me-1"></i>Filtrar
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="limpar()" [disabled]="loading()">Limpar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (erro()) {
          <div class="alert alert-danger m-3 py-2" role="alert">{{ erro() }}</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 small">
              <thead class="table-light">
                <tr><th class="ps-3">Data/hora</th><th>Nível</th><th>Origem</th><th>Mensagem</th></tr>
              </thead>
              <tbody>
                @for (l of itens(); track l.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(l.timestamp) }}</td>
                    <td><span class="badge" [class]="badge(l.nivel)">{{ l.nivel }}</span></td>
                    <td class="text-muted">{{ l.origem || '—' }}</td>
                    <td>{{ l.mensagem }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-muted py-4">Nenhum log encontrado.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ itens().length }} de {{ total() }}</span>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="pagina() === 1" (click)="carregar(pagina() - 1)">Anterior</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="!temProxima()" (click)="carregar(pagina() + 1)">Próxima</button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class LogsSistemaComponent implements OnInit {
  private service = inject(PlataformaEventoService);

  formatarDataHora = formatarDataHora;
  readonly niveis = NIVEIS;
  readonly pageSize = PAGE_SIZE;

  nivel = '';
  dataInicio = '';
  dataFim = '';
  readonly avisoPeriodo = AVISO_INTERVALO_INVERTIDO;
  periodoInvertido = () => intervaloInvertido(this.dataInicio, this.dataFim);

  itens = signal<LogSistema[]>([]);
  total = signal(0);
  pagina = signal(1);
  loading = signal(false);
  erro = signal('');
  temProxima = computed(() => this.pagina() * PAGE_SIZE < this.total());

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page: number) {
    if (this.periodoInvertido()) return;
    this.loading.set(true);
    this.erro.set('');
    this.service.logs({
      nivel: this.nivel || undefined,
      dataInicio: inicioDoDiaLocalISO(this.dataInicio),
      dataFim: fimDoDiaLocalISO(this.dataFim),
      page,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.pagina.set(page); this.loading.set(false); },
      error: err => { this.erro.set(lerErroApi(err, 'Erro ao carregar os logs do sistema.').mensagem); this.loading.set(false); }
    });
  }

  limpar() {
    this.nivel = '';
    this.dataInicio = '';
    this.dataFim = '';
    this.carregar(1);
  }

  badge(nivel: string): string {
    const n = nivel.toLowerCase();
    if (n.startsWith('err') || n.startsWith('fat') || n.startsWith('crit')) return 'bg-danger-subtle text-danger';
    if (n.startsWith('warn')) return 'bg-warning-subtle text-warning';
    if (n.startsWith('info')) return 'bg-primary-subtle text-primary';
    return 'bg-secondary-subtle text-secondary';
  }
}
