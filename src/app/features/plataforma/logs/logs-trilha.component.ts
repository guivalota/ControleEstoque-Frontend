import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaEventoService } from '../../../core/services/plataforma-evento.service';
import { PlataformaEvento } from '../../../core/models/plataforma-evento.model';
import { ehUuid, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { AVISO_INTERVALO_INVERTIDO, fimDoDiaLocalISO, inicioDoDiaLocalISO, intervaloInvertido } from '../../../core/utils/periodo';

const PAGE_SIZE = 50;

/** Ações gravadas em plataforma_eventos (DSG-07 e planos/limites do DSG-04). */
export const ACOES_TRILHA = [
  'criou_empresa', 'alterou_empresa', 'desativou_empresa', 'reativou_empresa', 'removeu_empresa',
  'vinculou_usuario', 'alterou_perfil_vinculo', 'desvinculou_usuario',
  'criou_admin_inicial', 'criou_usuario_empresa', 'alterou_perfil_usuario_empresa',
  'redefiniu_senha_usuario_empresa', 'desativou_usuario_empresa', 'reativou_usuario_empresa',
  'ligou_modulo', 'desligou_modulo', 'alterou_modulos_usuario',
  'criou_superadmin', 'redefiniu_senha_superadmin', 'desativou_superadmin', 'reativou_superadmin',
  'criou_plano', 'alterou_plano', 'desativou_plano', 'reativou_plano',
  'definiu_plano_empresa', 'alterou_limites_empresa'
];

/** Aba "Trilha": plataforma_eventos (GET v1/plataforma/eventos), pageSize máx. 100. */

@Component({
  selector: 'app-logs-trilha',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body py-3">
        <div class="row g-2 align-items-end">
          <div class="col-md-2">
            <label for="trEmpresa" class="form-label small mb-1">Empresa (id)</label>
            <input id="trEmpresa" type="number" min="1" class="form-control form-control-sm" [(ngModel)]="empresaId">
          </div>
          <div class="col-md-3">
            <label for="trAtor" class="form-label small mb-1">Ator (UUID)</label>
            <input id="trAtor" class="form-control form-control-sm font-monospace" [(ngModel)]="atorId"
                   [class.is-invalid]="erroAtor()" (ngModelChange)="erroAtor.set('')">
            <div class="invalid-feedback">{{ erroAtor() }}</div>
          </div>
          <div class="col-md-2">
            <label for="trAcao" class="form-label small mb-1">Ação</label>
            <select id="trAcao" class="form-select form-select-sm" [(ngModel)]="acao">
              <option value="">Todas</option>
              @for (a of acoes; track a) { <option [value]="a">{{ a }}</option> }
            </select>
          </div>
          <div class="col-md-2">
            <label for="trIni" class="form-label small mb-1">Data início</label>
            <input id="trIni" type="date" class="form-control form-control-sm" [(ngModel)]="dataInicio">
          </div>
          <div class="col-md-2">
            <label for="trFim" class="form-label small mb-1">Data fim</label>
            <input id="trFim" type="date" class="form-control form-control-sm" [(ngModel)]="dataFim">
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
                <tr><th class="ps-3">Data/hora</th><th>Ação</th><th>Ator</th><th>Empresa</th><th>Usuário alvo</th><th>Detalhe</th></tr>
              </thead>
              <tbody>
                @for (e of eventos(); track e.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(e.criadoEm) }}</td>
                    <td>{{ e.acao }}</td>
                    <td>{{ e.atorNome || '—' }}</td>
                    <td>{{ e.empresaNome || '—' }}</td>
                    <td>{{ e.alvoNome || '—' }}</td>
                    <td class="text-muted">{{ e.detalhe || '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="text-center text-muted py-4">Nenhum evento encontrado.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ eventos().length }} de {{ total() }}</span>
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
export class LogsTrilhaComponent implements OnInit {
  private service = inject(PlataformaEventoService);

  /** Pré-filtro vindo da tela da empresa (?empresaId=). */
  empresaIdInicial = input<number | undefined>(undefined);

  formatarDataHora = formatarDataHora;
  readonly pageSize = PAGE_SIZE;

  empresaId: number | null = null;
  atorId = '';
  acao = '';
  readonly acoes = ACOES_TRILHA;
  erroAtor = signal('');
  dataInicio = '';
  dataFim = '';
  readonly avisoPeriodo = AVISO_INTERVALO_INVERTIDO;
  periodoInvertido = () => intervaloInvertido(this.dataInicio, this.dataFim);

  eventos = signal<PlataformaEvento[]>([]);
  total = signal(0);
  pagina = signal(1);
  loading = signal(false);
  erro = signal('');
  temProxima = computed(() => this.pagina() * PAGE_SIZE < this.total());

  ngOnInit() {
    this.empresaId = this.empresaIdInicial() ?? null;
    this.carregar(1);
  }

  carregar(page: number) {
    if (this.periodoInvertido()) return;
    const ator = this.atorId.trim();
    if (ator && !ehUuid(ator)) {
      this.erroAtor.set('Informe um UUID válido (ex.: 3fa85f64-5717-4562-b3fc-2c963f66afa6).');
      return;
    }
    this.erroAtor.set('');
    this.loading.set(true);
    this.erro.set('');
    this.service.eventos({
      empresaId: this.empresaId || undefined,
      atorId: ator || undefined,
      acao: this.acao.trim() || undefined,
      dataInicio: inicioDoDiaLocalISO(this.dataInicio),
      dataFim: fimDoDiaLocalISO(this.dataFim),
      page,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.eventos.set(r.items); this.total.set(r.total); this.pagina.set(page); this.loading.set(false); },
      error: err => {
        this.eventos.set([]);
        this.total.set(0);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar a trilha.'), 'Erro ao carregar a trilha.'));
        this.loading.set(false);
      }
    });
  }

  limpar() {
    this.empresaId = null;
    this.atorId = '';
    this.erroAtor.set('');
    this.acao = '';
    this.dataInicio = '';
    this.dataFim = '';
    this.carregar(1);
  }
}
