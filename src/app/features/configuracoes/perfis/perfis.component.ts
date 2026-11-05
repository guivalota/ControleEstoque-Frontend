import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { PerfilAcessoService } from '../../../core/services/perfil-acesso.service';
import { PerfilAcesso } from '../../../core/models/perfil-acesso.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { PodeDesabilitarDirective } from '../../../shared/permissao/pode.directive';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';
import { PerfilEditorComponent } from './perfil-editor.component';

/** Configurações → Perfis: lista os perfis da empresa (de sistema e próprios) e abre o editor de permissões. */
@Component({
  selector: 'app-configuracoes-perfis',
  standalone: true,
  imports: [PerfilEditorComponent, ConfirmDialogComponent, PodeDesabilitarDirective],
  template: `
    @if (editor(); as e) {
      <app-perfil-editor [perfilId]="e.id" [copiarDeId]="e.copiarDeId" (salvo)="aoSalvar()" (cancelar)="editor.set(null)" />
    } @else {
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold mb-0">Perfis de acesso</h6>
        <button type="button" class="btn btn-primary btn-sm" [appPodeDesabilitar]="'core.acesso.gerir'"
                (click)="editor.set({ id: null, copiarDeId: null })">
          <i class="bi bi-plus-lg me-1"></i>Novo perfil
        </button>
      </div>

      @if (feedback()) {
        <div class="alert alert-success alert-dismissible py-2" role="status">
          {{ feedback() }}
          <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
        </div>
      }
      @if (erro()) {
        <div class="alert alert-danger alert-dismissible py-2" role="alert">
          {{ erro() }}
          <button type="button" class="btn-close" aria-label="Fechar" (click)="erro.set('')"></button>
        </div>
      }

      <div class="card border-0 shadow-sm">
        <div class="card-body p-0">
          @if (loading()) {
            <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
          } @else if (erroLista()) {
            <div class="alert alert-danger d-flex justify-content-between align-items-center m-3 py-2" role="alert">
              <span>{{ erroLista() }}</span>
              <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr><th class="ps-3">Perfil</th><th>Descrição</th><th class="text-end">Usuários</th><th class="text-end">Permissões</th><th class="text-end pe-3">Ações</th></tr>
                </thead>
                <tbody>
                  @for (p of perfis(); track p.id) {
                    <tr [class.text-muted]="!p.ativo">
                      <td class="ps-3">
                        @if (p.todasPermissoes) { <i class="bi bi-lock me-1" title="Não pode ser alterado"></i> }
                        <strong>{{ p.nome }}</strong>
                        @if (p.sistema) { <span class="badge bg-secondary-subtle text-secondary ms-1">padrão</span> }
                        @if (!p.ativo) { <span class="badge bg-secondary-subtle text-secondary ms-1">inativo</span> }
                      </td>
                      <td class="small">{{ p.descricao || '—' }}</td>
                      <td class="text-end">{{ p.usuarios }}</td>
                      <td class="text-end">{{ p.todasPermissoes ? 'Todas' : p.totalPermissoes }}</td>
                      <td class="text-end pe-3 text-nowrap">
                        <button type="button" class="btn btn-sm btn-outline-primary me-1" (click)="editor.set({ id: p.id, copiarDeId: null })"
                                [title]="p.todasPermissoes ? 'Ver' : 'Editar'" [attr.aria-label]="(p.todasPermissoes ? 'Ver ' : 'Editar ') + p.nome">
                          <i class="bi" [class.bi-eye]="p.todasPermissoes" [class.bi-pencil]="!p.todasPermissoes"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1" [appPodeDesabilitar]="'core.acesso.gerir'"
                                (click)="editor.set({ id: null, copiarDeId: p.id })" title="Copiar" [attr.aria-label]="'Copiar ' + p.nome">
                          <i class="bi bi-files"></i>
                        </button>
                        @if (p.sistema && !p.todasPermissoes) {
                          <button type="button" class="btn btn-sm btn-outline-secondary me-1" [appPodeDesabilitar]="'core.acesso.gerir'"
                                  (click)="restaurar(p)" title="Restaurar o padrão" [attr.aria-label]="'Restaurar o padrão de ' + p.nome">
                            <i class="bi bi-arrow-counterclockwise"></i>
                          </button>
                        }
                        @if (!p.todasPermissoes) {
                          <button type="button" class="btn btn-sm me-1" [class.btn-outline-warning]="p.ativo" [class.btn-outline-success]="!p.ativo"
                                  [appPodeDesabilitar]="'core.acesso.gerir'" (click)="alternarAtivo(p)"
                                  [title]="p.ativo ? 'Inativar' : 'Ativar'" [attr.aria-label]="(p.ativo ? 'Inativar ' : 'Ativar ') + p.nome">
                            <i class="bi" [class.bi-slash-circle]="p.ativo" [class.bi-check-circle]="!p.ativo"></i>
                          </button>
                        }
                        @if (!p.sistema) {
                          <button type="button" class="btn btn-sm btn-outline-danger" [appPodeDesabilitar]="'core.acesso.gerir'"
                                  (click)="excluir(p)" title="Excluir" [attr.aria-label]="'Excluir ' + p.nome">
                            <i class="bi bi-trash"></i>
                          </button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="text-center text-muted py-4">Nenhum perfil.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
      <p class="text-muted small mt-2 mb-0">
        Cada empresa monta os próprios perfis. Para escolher o perfil de uma pessoa, use a aba Equipe.
      </p>
    }
    <app-confirm-dialog />
  `
})
export class PerfisComponent implements OnInit {
  private api = inject(PerfilAcessoService);
  private confirmar = viewChild.required(ConfirmDialogComponent);

  perfis = signal<PerfilAcesso[]>([]);
  loading = signal(false);
  erro = signal('');
  erroLista = signal('');
  feedback = signal('');
  /** Editor aberto: `id` nulo = novo; `copiarDeId` = novo a partir de outro. */
  editor = signal<{ id: number | null; copiarDeId: number | null } | null>(null);

  ngOnInit() { this.carregar(); }

  carregar() {
    this.loading.set(true);
    this.erroLista.set('');
    this.api.listar().subscribe({
      next: l => { this.perfis.set(l); this.loading.set(false); },
      error: err => { this.erroLista.set(lerErroApi(err, 'Erro ao carregar os perfis.').mensagem); this.loading.set(false); }
    });
  }

  aoSalvar() {
    this.editor.set(null);
    this.feedback.set('Perfil salvo.');
    this.carregar();
  }

  async restaurar(p: PerfilAcesso) {
    const ok = await this.confirmar().abrir({
      titulo: 'Restaurar o padrão',
      mensagem: `Devolver ${p.nome} às permissões do modelo? As alterações feitas neste perfil serão perdidas.`,
      confirmar: 'Restaurar'
    });
    if (ok) this.executar(this.api.restaurarPadrao(p.id), `${p.nome} voltou ao padrão.`, 'Erro ao restaurar o perfil.');
  }

  alternarAtivo(p: PerfilAcesso) {
    this.executar(this.api.definirAtivo(p.id, !p.ativo), p.ativo ? `${p.nome} inativado.` : `${p.nome} ativado.`, 'Erro ao alterar a situação.');
  }

  async excluir(p: PerfilAcesso) {
    const ok = await this.confirmar().abrir({
      titulo: 'Excluir perfil',
      mensagem: `Excluir o perfil ${p.nome}? Só é possível se ninguém o usa.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (ok) this.executar(this.api.excluir(p.id), `${p.nome} excluído.`, 'Erro ao excluir o perfil.');
  }

  private executar(chamada: Observable<unknown>, sucesso: string, padrao: string) {
    this.erro.set('');
    this.feedback.set('');
    chamada.subscribe({
      next: () => { this.feedback.set(sucesso); this.carregar(); },
      error: err => this.erro.set(lerErroApi(err, padrao).mensagem)
    });
  }
}
