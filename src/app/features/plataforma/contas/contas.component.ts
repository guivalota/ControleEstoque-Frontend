import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContaNovaComponent } from './conta-nova.component';
import { ContaVinculoComponent } from './conta-vinculo.component';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';

const PAGE_SIZE = 50;

const ROTULO_TIPO: Record<string, string> = {
  superadmin: 'Super admin',
  plataforma: 'Plataforma',
  cliente: 'Cliente'
};

/** Diretório de contas (GET v1/users, só super admin): coluna tipo, busca e paginação. */
@Component({
  selector: 'app-plataforma-contas',
  standalone: true,
  imports: [FormsModule, ContaNovaComponent, ContaVinculoComponent],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h5 class="fw-bold mb-0">Contas</h5>
      <div class="d-flex align-items-center gap-3">
        <span class="text-muted small">{{ total() }} conta(s)</span>
        <button type="button" class="btn btn-primary btn-sm" (click)="novaAberta.set(!novaAberta()); vinculoConta.set(null)">
          <i class="bi bi-person-plus me-1"></i>Nova conta de plataforma
        </button>
      </div>
    </div>

    @if (feedback()) {
      <div class="alert alert-success alert-dismissible py-2" role="status">
        {{ feedback() }}
        <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
      </div>
    }
    @if (novaAberta()) {
      <app-conta-nova (fechar)="novaAberta.set(false)" (criada)="aoCriar($event)" />
    }
    @if (vinculoConta(); as c) {
      @for (k of [c.id]; track k) {
        <app-conta-vinculo [conta]="c" (fechar)="vinculoConta.set(null)" (concluido)="aoVincular($event)" />
      }
    }

    <div class="mb-3" style="max-width: 420px">
      <label for="contasBusca" class="visually-hidden">Buscar</label>
      <input id="contasBusca" type="search" class="form-control form-control-sm" placeholder="Buscar por nome ou e-mail (nesta página)"
             [ngModel]="busca()" (ngModelChange)="busca.set($event)">
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (erro()) {
          <div class="alert alert-danger d-flex justify-content-between align-items-center m-3 py-2" role="alert">
            <span>{{ erro() }}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar(pagina())">Tentar novamente</button>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th class="ps-3">Nome</th><th>E-mail</th><th>Tipo</th><th>Situação</th><th>Criada em</th><th class="text-end pe-3">Ações</th></tr>
              </thead>
              <tbody>
                @for (c of filtradas(); track c.id) {
                  <tr>
                    <td class="ps-3">{{ c.nome }}</td>
                    <td>{{ c.email }}</td>
                    <td><span class="badge bg-info-subtle text-info-emphasis">{{ rotuloTipo(c.tipo) }}</span></td>
                    <td>
                      <span class="badge" [class.bg-success-subtle]="c.ativo" [class.text-success]="c.ativo"
                            [class.bg-secondary-subtle]="!c.ativo" [class.text-secondary]="!c.ativo">{{ c.ativo ? 'Ativa' : 'Inativa' }}</span>
                    </td>
                    <td class="text-nowrap">{{ formatarDataHora(c.criadoEm) }}</td>
                    <td class="text-end pe-3">
                      @if (c.tipo !== 'superadmin') {
                        <button type="button" class="btn btn-sm btn-outline-secondary" (click)="abrirVinculo(c)" [attr.aria-label]="'Vínculo de ' + c.nome">
                          <i class="bi bi-building me-1"></i>Vínculo
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="text-center text-muted py-4">Nenhuma conta encontrada.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ contas().length }} de {{ total() }}</span>
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
export class PlataformaContasComponent implements OnInit {
  private service = inject(UserService);

  readonly pageSize = PAGE_SIZE;
  formatarDataHora = formatarDataHora;

  contas = signal<User[]>([]);
  total = signal(0);
  pagina = signal(1);
  loading = signal(false);
  erro = signal('');
  busca = signal('');
  novaAberta = signal(false);
  vinculoConta = signal<User | null>(null);
  feedback = signal('');

  /** O servidor não tem filtro de busca em GET v1/users: filtra a página carregada. */
  filtradas = computed(() => {
    const t = this.busca().trim().toLowerCase();
    if (!t) return this.contas();
    return this.contas().filter(c => c.nome.toLowerCase().includes(t) || c.email.toLowerCase().includes(t));
  });

  temProxima = computed(() => this.pagina() * PAGE_SIZE < this.total());

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page: number) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listarPagina(page, PAGE_SIZE).subscribe({
      next: r => {
        this.contas.set(r.items);
        this.total.set(r.total);
        this.pagina.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar as contas.').mensagem);
        this.loading.set(false);
      }
    });
  }

  abrirVinculo(c: User) {
    this.novaAberta.set(false);
    this.vinculoConta.set(c);
  }

  aoCriar(msg: string) {
    this.novaAberta.set(false);
    this.feedback.set(msg);
    this.carregar(this.pagina());
  }

  aoVincular(msg: string) {
    this.vinculoConta.set(null);
    this.feedback.set(msg);
  }

  rotuloTipo(tipo?: string): string {
    return tipo ? (ROTULO_TIPO[tipo.toLowerCase()] ?? tipo) : '—';
  }
}
