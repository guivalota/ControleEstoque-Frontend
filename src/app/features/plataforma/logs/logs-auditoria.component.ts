import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuditLog } from '../../../core/models/audit-log.model';
import { ehUuid, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { AVISO_INTERVALO_INVERTIDO, fimDoDiaLocalISO, inicioDoDiaLocalISO, intervaloInvertido } from '../../../core/utils/periodo';

const PAGE_SIZE = 50;
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const BADGE: Record<string, string> = {
  GET: 'bg-primary-subtle text-primary',
  POST: 'bg-success-subtle text-success',
  PUT: 'bg-warning-subtle text-warning',
  DELETE: 'bg-danger-subtle text-danger'
};

/** Aba "Auditoria de acesso": GET v1/audit-logs (só super admin). `usuarioId` é UUID (US-03-09 pronta no back). */

@Component({
  selector: 'app-logs-auditoria',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label for="auUsuario" class="form-label small mb-1">Usuário (UUID)</label>
            <input id="auUsuario" class="form-control form-control-sm font-monospace" [(ngModel)]="usuarioId"
                   [class.is-invalid]="erroUsuario()" (ngModelChange)="erroUsuario.set('')">
            <div class="invalid-feedback">{{ erroUsuario() }}</div>
          </div>
          <div class="col-md-2">
            <label for="auMetodo" class="form-label small mb-1">Método</label>
            <select id="auMetodo" class="form-select form-select-sm" [(ngModel)]="method">
              <option value="">Todos</option>
              @for (m of methods; track m) { <option [value]="m">{{ m }}</option> }
            </select>
          </div>
          <div class="col-md-2">
            <label for="auEmpresa" class="form-label small mb-1">Empresa (id)</label>
            <input id="auEmpresa" type="number" min="1" class="form-control form-control-sm" [(ngModel)]="empresaId">
          </div>
          <div class="col-md-3">
            <label for="auEndpoint" class="form-label small mb-1">Endpoint</label>
            <input id="auEndpoint" class="form-control form-control-sm" placeholder="/v1/produtos" [(ngModel)]="endpoint">
          </div>
          <div class="col-md-2"></div>
          <div class="col-md-2">
            <label for="auIni" class="form-label small mb-1">Data início</label>
            <input id="auIni" type="date" class="form-control form-control-sm" [(ngModel)]="dataInicio">
          </div>
          <div class="col-md-2">
            <label for="auFim" class="form-label small mb-1">Data fim</label>
            <input id="auFim" type="date" class="form-control form-control-sm" [(ngModel)]="dataFim">
          </div>
          @if (periodoInvertido()) {
            <div class="col-12"><div class="text-warning-emphasis small" role="alert"><i class="bi bi-exclamation-triangle me-1"></i>{{ avisoPeriodo }}</div></div>
          }
          <div class="col-12 d-flex gap-2">
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
                <tr><th class="ps-3">Data/hora</th><th>Usuário</th><th>Método</th><th>Endpoint</th><th>Empresa</th><th>Recurso</th><th>IP</th></tr>
              </thead>
              <tbody>
                @for (l of logs(); track l.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(l.criadoEm) }}</td>
                    <td><span [title]="l.usuarioId">{{ l.usuarioNome }}</span></td>
                    <td><span class="badge" [class]="badge(l.method)">{{ l.method }}</span></td>
                    <td class="font-monospace text-muted">{{ l.endpoint }}</td>
                    <td class="text-muted">{{ l.empresaNome || '—' }}</td>
                    <td class="text-muted">{{ l.recursoId ?? '—' }}</td>
                    <td class="font-monospace text-muted">{{ l.ip }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-center text-muted py-4">Nenhum log encontrado.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ logs().length }} de {{ total() }}</span>
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
export class LogsAuditoriaComponent implements OnInit {
  private service = inject(AuditLogService);

  formatarDataHora = formatarDataHora;
  readonly methods = METHODS;
  readonly pageSize = PAGE_SIZE;

  usuarioId = '';
  erroUsuario = signal('');
  method = '';
  endpoint = '';
  empresaId: number | null = null;
  dataInicio = '';
  dataFim = '';
  readonly avisoPeriodo = AVISO_INTERVALO_INVERTIDO;
  periodoInvertido = () => intervaloInvertido(this.dataInicio, this.dataFim);

  logs = signal<AuditLog[]>([]);
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
    const usuario = this.usuarioId.trim();
    if (usuario && !ehUuid(usuario)) {
      this.erroUsuario.set('Informe um UUID válido (ex.: 3fa85f64-5717-4562-b3fc-2c963f66afa6).');
      return;
    }
    this.erroUsuario.set('');
    this.loading.set(true);
    this.erro.set('');
    this.service.getAll({
      usuarioId: usuario || undefined,
      method: this.method || undefined,
      endpoint: this.endpoint.trim() || undefined,
      empresaId: this.empresaId || undefined,
      dataInicio: inicioDoDiaLocalISO(this.dataInicio),
      dataFim: fimDoDiaLocalISO(this.dataFim),
      page,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.logs.set(r.items); this.total.set(r.total); this.pagina.set(page); this.loading.set(false); },
      error: err => {
        this.logs.set([]);
        this.total.set(0);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar a auditoria de acesso.'), 'Erro ao carregar a auditoria de acesso.'));
        this.loading.set(false);
      }
    });
  }

  limpar() {
    this.usuarioId = '';
    this.erroUsuario.set('');
    this.method = '';
    this.endpoint = '';
    this.empresaId = null;
    this.dataInicio = '';
    this.dataFim = '';
    this.carregar(1);
  }

  badge(method: string): string {
    return BADGE[method] ?? 'bg-secondary-subtle text-secondary';
  }
}
