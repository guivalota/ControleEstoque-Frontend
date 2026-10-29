import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { formatarCnpj } from '../../../core/utils/cnpj';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { PlataformaAdminInicialComponent } from './plataforma-admin-inicial.component';
import { PlataformaEmpresaFormComponent } from './plataforma-empresa-form.component';
import { PlataformaEmpresaModulosComponent } from './plataforma-empresa-modulos.component';
import { PlataformaEmpresaPlanoComponent } from './plataforma-empresa-plano.component';
import { PlataformaBloqueioModalComponent } from './plataforma-bloqueio-modal.component';
import { PlataformaEmpresaBloqueiosComponent } from './plataforma-empresa-bloqueios.component';
import { EmpresaEquipeComponent } from './empresa-equipe.component';
import { EmpresaConfiguracaoComponent } from './empresa-configuracao.component';

type Aba = 'dados' | 'modulos' | 'plano' | 'equipe' | 'configuracao' | 'bloqueios';

@Component({
  selector: 'app-plataforma-empresa-detalhe',
  standalone: true,
  imports: [RouterLink, PlataformaEmpresaFormComponent, PlataformaAdminInicialComponent,
    PlataformaEmpresaModulosComponent, PlataformaEmpresaPlanoComponent, EmpresaEquipeComponent, EmpresaConfiguracaoComponent,
    PlataformaBloqueioModalComponent, PlataformaEmpresaBloqueiosComponent],
  template: `
    <a routerLink="/plataforma/empresas" class="small"><i class="bi bi-arrow-left me-1"></i>Empresas</a>

    @if (loading()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erro()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2 mt-2" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else if (empresa()) {
      @let e = empresa()!;
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 my-2">
        <h5 class="fw-bold mb-0">
          {{ e.razaoSocial }}
          @if (e.ativo) {
            <span class="badge bg-success-subtle text-success ms-2 fs-6">Ativa</span>
          } @else {
            <span class="badge bg-danger-subtle text-danger ms-2 fs-6">Bloqueada</span>
          }
        </h5>
        <div class="d-flex gap-2">
          <a class="btn btn-sm btn-outline-secondary" routerLink="/plataforma/logs" [queryParams]="{ empresaId: e.id }">
            <i class="bi bi-clock-history me-1"></i>Trilha
          </a>
          <button type="button" class="btn btn-sm" [class.btn-outline-warning]="e.ativo" [class.btn-outline-success]="!e.ativo" (click)="bloqueio().abrir(e)">
            <i class="bi me-1" [class.bi-slash-circle]="e.ativo" [class.bi-check-circle]="!e.ativo"></i>{{ e.ativo ? 'Bloquear' : 'Desbloquear' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="form().abrir(e)">
            <i class="bi bi-pencil me-1"></i>Editar
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="admin().abrir(e)">
            <i class="bi bi-person-plus me-1"></i>Criar administrador inicial
          </button>
        </div>
      </div>

      @if (feedback()) {
        <div class="alert alert-success alert-dismissible py-2" role="status">
          {{ feedback() }}
          <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
        </div>
      }

      <ul class="nav nav-tabs mb-3" role="tablist">
        @for (a of abas; track a.id) {
          <li class="nav-item" role="presentation">
            <button type="button" class="nav-link" role="tab" [class.active]="aba() === a.id"
                    [attr.aria-selected]="aba() === a.id" (click)="aba.set(a.id)">{{ a.rotulo }}</button>
          </li>
        }
      </ul>

      @switch (aba()) {
        @case ('dados') {
          <dl class="row mb-0">
            <dt class="col-sm-3">Razão social</dt><dd class="col-sm-9">{{ e.razaoSocial }}</dd>
            <dt class="col-sm-3">Nome fantasia</dt><dd class="col-sm-9">{{ e.nomeFantasia || '—' }}</dd>
            <dt class="col-sm-3">CNPJ</dt><dd class="col-sm-9">{{ formatarCnpj(e.cnpj) }}</dd>
            <dt class="col-sm-3">Situação</dt><dd class="col-sm-9">{{ e.ativo ? 'Ativa' : 'Bloqueada' }}</dd>
            <dt class="col-sm-3">Criada em</dt><dd class="col-sm-9">{{ formatarDataHora(e.criadoEm) }}</dd>
          </dl>
        }
        @case ('modulos') { <app-plataforma-empresa-modulos [empresaId]="e.id" /> }
        @case ('plano') { <app-plataforma-empresa-plano [empresaId]="e.id" /> }
        @case ('equipe') { <app-empresa-equipe [empresaId]="e.id" /> }
        @case ('configuracao') { <app-empresa-configuracao [empresaId]="e.id" /> }
        @case ('bloqueios') {
          @for (v of [versaoBloqueios()]; track v) { <app-plataforma-empresa-bloqueios [empresaId]="e.id" /> }
        }
      }
    }

    <app-plataforma-empresa-form (salvo)="aoSalvar($event)" />
    <app-plataforma-bloqueio-modal (concluido)="aoBloqueio($event)" />
    <app-plataforma-admin-inicial (criado)="feedback.set('Administrador inicial criado.')" />
  `
})
export class PlataformaEmpresaDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(PlataformaEmpresaService);
  form = viewChild.required(PlataformaEmpresaFormComponent);
  admin = viewChild.required(PlataformaAdminInicialComponent);
  bloqueio = viewChild.required(PlataformaBloqueioModalComponent);

  formatarCnpj = formatarCnpj;
  formatarDataHora = formatarDataHora;
  readonly abas: { id: Aba; rotulo: string }[] = [
    { id: 'dados', rotulo: 'Dados' },
    { id: 'modulos', rotulo: 'Módulos' },
    { id: 'plano', rotulo: 'Plano e limites' },
    { id: 'equipe', rotulo: 'Equipe' },
    { id: 'configuracao', rotulo: 'Configuração' },
    { id: 'bloqueios', rotulo: 'Bloqueios' }
  ];

  aba = signal<Aba>('dados');
  empresa = signal<PlataformaEmpresa | null>(null);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  versaoBloqueios = signal(0);

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.erro.set('');
    this.service.obter(id).subscribe({
      next: e => { this.empresa.set(e); this.loading.set(false); },
      error: err => {
        this.erro.set(err?.status === 404 ? 'Empresa não encontrada.' : lerErroApi(err, 'Erro ao carregar a empresa.').mensagem);
        this.loading.set(false);
      }
    });
  }

  aoSalvar(r: { empresa: PlataformaEmpresa }) {
    this.empresa.set(r.empresa);
    this.feedback.set('Empresa atualizada.');
  }

  aoBloqueio(r: { empresa: PlataformaEmpresa; bloqueou: boolean }) {
    this.empresa.set(r.empresa);
    this.versaoBloqueios.update(v => v + 1);
    this.feedback.set(r.bloqueou ? 'Empresa bloqueada.' : 'Empresa desbloqueada.');
  }
}
