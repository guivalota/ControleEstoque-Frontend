import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { formatarCnpj, normalizarCnpj } from '../../../core/utils/cnpj';
import { lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';
import { PaginacaoComponent } from '../../imobilizado/shared/paginacao.component';
import { PlataformaAdminInicialComponent } from './plataforma-admin-inicial.component';
import { PlataformaBloqueioModalComponent } from './plataforma-bloqueio-modal.component';
import { PlataformaOnboardingComponent } from './plataforma-onboarding.component';
import { PlataformaEmpresaFormComponent } from './plataforma-empresa-form.component';

const PAGE_SIZE = 100;

/** Lista de empresas da plataforma. A API só pagina (page/pageSize): busca e filtro agem sobre a página carregada. */
@Component({
  selector: 'app-plataforma-empresas',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmDialogComponent, PaginacaoComponent, PlataformaEmpresaFormComponent, PlataformaAdminInicialComponent,
    PlataformaBloqueioModalComponent, PlataformaOnboardingComponent],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h5 class="fw-bold mb-0">Empresas</h5>
      <button type="button" class="btn btn-primary btn-sm" (click)="onboarding().abrir()">
        <i class="bi bi-plus-lg me-1"></i>Nova empresa
      </button>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-6">
        <label for="plBusca" class="form-label small mb-1">Buscar por razão social, fantasia ou CNPJ</label>
        <input id="plBusca" class="form-control form-control-sm" type="search" [ngModel]="busca()"
               (ngModelChange)="busca.set($event)" autocomplete="off">
      </div>
      <div class="col-6 col-md-3">
        <label for="plFiltroAtivo" class="form-label small mb-1">Situação</label>
        <select id="plFiltroAtivo" class="form-select form-select-sm" [ngModel]="filtroAtivo()"
                (ngModelChange)="filtroAtivo.set($event)">
          <option value="todas">Todas</option>
          <option value="ativas">Ativas</option>
          <option value="bloqueadas">Bloqueadas</option>
        </select>
      </div>
    </div>

    @if (feedback()) {
      <div class="alert alert-success alert-dismissible py-2" role="status">
        {{ feedback() }}
        <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
      </div>
    }
    @if (erro()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    }

    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm me-2"></div>Carregando...
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th class="ps-3">Razão social</th>
                  <th>Nome fantasia</th>
                  <th>CNPJ</th>
                  <th>Situação</th>
                  <th class="text-end pe-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (e of filtradas(); track e.id) {
                  <tr>
                    <td class="ps-3"><a [routerLink]="['/plataforma/empresas', e.id]">{{ e.razaoSocial }}</a></td>
                    <td class="text-muted">{{ e.nomeFantasia || '—' }}</td>
                    <td class="text-nowrap">{{ formatarCnpj(e.cnpj) }}</td>
                    <td>
                      @if (e.ativo) {
                        <span class="badge bg-success-subtle text-success">Ativa</span>
                      } @else {
                        <span class="badge bg-danger-subtle text-danger">Bloqueada</span>
                      }
                    </td>
                    <td class="text-end pe-3 text-nowrap">
                      <a class="btn btn-sm btn-outline-primary me-1" [routerLink]="['/plataforma/empresas', e.id]"
                         title="Detalhes" [attr.aria-label]="'Detalhes de ' + e.razaoSocial"><i class="bi bi-eye"></i></a>
                      <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="form().abrir(e)"
                              title="Editar" [attr.aria-label]="'Editar ' + e.razaoSocial"><i class="bi bi-pencil"></i></button>
                      <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="admin().abrir(e)"
                              title="Criar administrador inicial" [attr.aria-label]="'Criar administrador inicial de ' + e.razaoSocial">
                        <i class="bi bi-person-plus"></i>
                      </button>
                      <button type="button" class="btn btn-sm me-1" [class.btn-outline-warning]="e.ativo"
                              [class.btn-outline-success]="!e.ativo" [disabled]="agindo() === e.id"
                              (click)="bloqueio().abrir(e)" [title]="e.ativo ? 'Bloquear empresa' : 'Desbloquear empresa'"
                              [attr.aria-label]="(e.ativo ? 'Bloquear ' : 'Desbloquear ') + e.razaoSocial">
                        <i class="bi" [class.bi-slash-circle]="e.ativo" [class.bi-check-circle]="!e.ativo"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="agindo() === e.id"
                              (click)="excluir(e)" title="Excluir" [attr.aria-label]="'Excluir ' + e.razaoSocial">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                      <i class="bi bi-inbox me-2"></i>{{ empresas().length ? 'Nenhuma empresa corresponde ao filtro' : 'Nenhuma empresa cadastrada' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacao [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()"
                         (mudar)="carregar($event)" />
        }
      </div>
    </div>

    <app-plataforma-empresa-form (salvo)="aoSalvar($event)" />
    <app-plataforma-admin-inicial />
    <app-plataforma-bloqueio-modal (concluido)="aoBloqueio($event)" />
    <app-plataforma-onboarding (criada)="aoCriada()" />
    <app-confirm-dialog />
  `
})
export class PlataformaEmpresasComponent implements OnInit {
  private service = inject(PlataformaEmpresaService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  form = viewChild.required(PlataformaEmpresaFormComponent);
  admin = viewChild.required(PlataformaAdminInicialComponent);
  bloqueio = viewChild.required(PlataformaBloqueioModalComponent);
  onboarding = viewChild.required(PlataformaOnboardingComponent);

  readonly pageSize = PAGE_SIZE;
  formatarCnpj = formatarCnpj;

  empresas = signal<PlataformaEmpresa[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  agindo = signal<number | null>(null);

  busca = signal('');
  filtroAtivo = signal<'todas' | 'ativas' | 'bloqueadas'>('todas');

  filtradas = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const cnpjTermo = normalizarCnpj(termo);
    const filtro = this.filtroAtivo();
    return this.empresas().filter(e => {
      if (filtro === 'ativas' && !e.ativo) return false;
      if (filtro === 'bloqueadas' && e.ativo) return false;
      if (!termo) return true;
      return e.razaoSocial.toLowerCase().includes(termo)
        || (e.nomeFantasia ?? '').toLowerCase().includes(termo)
        || (cnpjTermo.length > 0 && normalizarCnpj(e.cnpj).includes(cnpjTermo));
    });
  });

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar(page, PAGE_SIZE).subscribe({
      next: res => {
        this.empresas.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar empresas.').mensagem);
        this.loading.set(false);
      }
    });
  }

  aoSalvar(r: { empresa: PlataformaEmpresa; criada: boolean }) {
    this.feedback.set(r.criada
      ? 'Empresa criada. Use "Criar administrador inicial" para liberar o acesso.'
      : 'Empresa atualizada.');
    this.carregar();
  }

  aoBloqueio(r: { empresa: PlataformaEmpresa; bloqueou: boolean }) {
    this.feedback.set(r.bloqueou ? 'Empresa bloqueada.' : 'Empresa desbloqueada.');
    this.carregar();
  }

  aoCriada() {
    this.feedback.set('Empresa criada com plano e administrador inicial.');
    this.carregar(1);
  }

  async excluir(e: PlataformaEmpresa) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir empresa',
      mensagem: `Excluir "${e.razaoSocial}"? Os usuários vinculados perdem o acesso imediatamente. Para uso cotidiano, prefira bloquear.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(e.id);
    this.service.excluir(e.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Empresa excluída.');
        this.carregar(this.empresas().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao excluir empresa.').mensagem);
      }
    });
  }
}
