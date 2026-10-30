import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaPlanoService } from '../../../core/services/plataforma-plano.service';
import { LIMITES, MODULOS_CONHECIDOS, Plano, SalvarPlano } from '../../../core/models/plataforma-plano.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

@Component({
  selector: 'app-plataforma-planos',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold mb-0">Planos</h5>
      <button type="button" class="btn btn-primary btn-sm" (click)="abrirForm()">
        <i class="bi bi-plus-lg me-1"></i>Novo plano
      </button>
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
          <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th class="ps-3">Plano</th><th>Módulos</th><th>Limites</th><th>Empresas</th><th>Situação</th>
                  <th class="text-end pe-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (p of planos(); track p.id) {
                  <tr>
                    <td class="ps-3">
                      <strong>{{ p.nome }}</strong>
                      @if (p.padrao) { <span class="badge bg-primary-subtle text-primary ms-1">Padrão</span> }
                      <div class="small text-muted">{{ p.codigo }}</div>
                    </td>
                    <td>{{ p.modulos.join(', ') || '—' }}</td>
                    <td class="small">{{ resumoLimites(p) }}</td>
                    <td>{{ p.empresasUsando }}</td>
                    <td>
                      <span class="badge" [class.bg-success-subtle]="p.ativo" [class.text-success]="p.ativo"
                            [class.bg-secondary-subtle]="!p.ativo" [class.text-secondary]="!p.ativo">{{ p.ativo ? 'Ativo' : 'Inativo' }}</span>
                    </td>
                    <td class="text-end pe-3 text-nowrap">
                      <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="abrirForm(p)"
                              title="Editar" [attr.aria-label]="'Editar plano ' + p.nome"><i class="bi bi-pencil"></i></button>
                      @if (!p.padrao && p.ativo) {
                        <button type="button" class="btn btn-sm btn-outline-primary me-1" [disabled]="agindo() === p.id"
                                (click)="tornarPadrao(p)" title="Tornar plano padrão" [attr.aria-label]="'Tornar ' + p.nome + ' o plano padrão'">
                          <i class="bi bi-star"></i>
                        </button>
                      }
                      @if (!p.padrao) {
                        <button type="button" class="btn btn-sm" [class.btn-outline-warning]="p.ativo" [class.btn-outline-success]="!p.ativo"
                                [disabled]="agindo() === p.id" (click)="alternarAtivo(p)"
                                [title]="p.ativo ? 'Desativar' : 'Ativar'" [attr.aria-label]="(p.ativo ? 'Desativar ' : 'Ativar ') + p.nome">
                          <i class="bi" [class.bi-slash-circle]="p.ativo" [class.bi-check-circle]="!p.ativo"></i>
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Nenhum plano cadastrado</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
    <p class="small text-muted mt-3 mb-0">
      <i class="bi bi-info-circle me-1"></i>O plano padrão é o das empresas novas e não pode ser desativado. Empresas já no plano não são afetadas ao desativá-lo.
    </p>

    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plPlanoTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" [formGroup]="form" (ngSubmit)="salvar()" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="plPlanoTitulo">{{ editingId() !== null ? 'Editar plano' : 'Novo plano' }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (saveError()) { <div class="alert alert-danger py-2" role="alert">{{ saveError() }}</div> }
            <div class="mb-3">
              <label for="plPlCodigo" class="form-label">Código *</label>
              <input id="plPlCodigo" class="form-control" formControlName="codigo" maxlength="40"
                     [class.is-invalid]="erroCampo('codigo')" aria-describedby="plPlCodigoAjuda">
              <div class="invalid-feedback">{{ erroCampo('codigo') }}</div>
              <div id="plPlCodigoAjuda" class="form-text">2 a 40 caracteres: minúsculas, números, hífen ou sublinhado.</div>
            </div>
            <div class="mb-3">
              <label for="plPlNome" class="form-label">Nome *</label>
              <input id="plPlNome" class="form-control" formControlName="nome" maxlength="100" [class.is-invalid]="erroCampo('nome')">
              <div class="invalid-feedback">{{ erroCampo('nome') }}</div>
            </div>
            <div class="mb-3">
              <label for="plPlDesc" class="form-label">Descrição</label>
              <textarea id="plPlDesc" class="form-control" rows="2" formControlName="descricao" maxlength="300"
                        [class.is-invalid]="erroCampo('descricao')"></textarea>
              <div class="invalid-feedback">{{ erroCampo('descricao') }}</div>
            </div>
            <fieldset class="mb-3">
              <legend class="form-label fs-6">Módulos</legend>
              @for (m of modulosDisponiveis(); track m.codigo) {
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" [id]="'plPlMod_' + m.codigo"
                         [checked]="modulosSel().includes(m.codigo)" (change)="alternarModulo(m.codigo)">
                  <label class="form-check-label" [for]="'plPlMod_' + m.codigo">{{ m.rotulo }}</label>
                </div>
              }
            </fieldset>
            <fieldset class="mb-3" formGroupName="limites">
              <legend class="form-label fs-6">Limites (vazio = ilimitado)</legend>
              @for (l of limites; track l.codigo) {
                <div class="mb-2">
                  <label [for]="'plPlLim_' + l.codigo" class="form-label small mb-1">{{ l.rotulo }}</label>
                  <input [id]="'plPlLim_' + l.codigo" type="number" min="0" step="1" class="form-control form-control-sm"
                         [formControlName]="l.codigo" [class.is-invalid]="form.get('limites.' + l.codigo)?.invalid">
                  <div class="invalid-feedback">Informe um inteiro maior ou igual a zero.</div>
                </div>
              }
            </fieldset>
            <div class="form-check form-switch">
              <input id="plPlPadrao" class="form-check-input" type="checkbox" role="switch" formControlName="padrao">
              <label for="plPlPadrao" class="form-check-label">Plano padrão (empresas novas)</label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
    <app-confirm-dialog />
  `
})
export class PlataformaPlanosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaPlanoService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly limites = LIMITES;

  planos = signal<Plano[]>([]);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  agindo = signal<number | null>(null);

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  modulosSel = signal<string[]>([]);
  modulosDisponiveis = signal(MODULOS_CONHECIDOS);

  form = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]{2,40}$/)]],
    nome: ['', [Validators.required, Validators.maxLength(100)]],
    descricao: ['', [Validators.maxLength(300)]],
    padrao: [false],
    limites: this.fb.group({
      max_usuarios: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
      max_bens: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
      max_produtos: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)])
    })
  });

  ngOnInit() {
    this.carregar();
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar().subscribe({
      next: p => { this.planos.set(p); this.loading.set(false); },
      error: err => { this.erro.set(lerErroApi(err, 'Erro ao carregar planos.').mensagem); this.loading.set(false); }
    });
  }

  resumoLimites(p: Plano): string {
    const partes = LIMITES.filter(l => p.limites?.[l.codigo] !== undefined).map(l => `${l.rotulo}: ${p.limites[l.codigo]}`);
    return partes.length ? partes.join(' · ') : 'Ilimitado';
  }

  abrirForm(p?: Plano) {
    this.editingId.set(p?.id ?? null);
    this.form.reset({
      codigo: p?.codigo ?? '',
      nome: p?.nome ?? '',
      descricao: p?.descricao ?? '',
      padrao: p?.padrao ?? false,
      limites: {
        max_usuarios: p?.limites?.['max_usuarios'] ?? null,
        max_bens: p?.limites?.['max_bens'] ?? null,
        max_produtos: p?.limites?.['max_produtos'] ?? null
      }
    });
    const conhecidos = new Set(MODULOS_CONHECIDOS.map(m => m.codigo));
    const extras = (p?.modulos ?? []).filter(c => !conhecidos.has(c)).map(c => ({ codigo: c, rotulo: c }));
    this.modulosDisponiveis.set([...MODULOS_CONHECIDOS, ...extras]);
    this.modulosSel.set([...(p?.modulos ?? [])]);
    this.saveError.set('');
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  alternarModulo(codigo: string) {
    this.modulosSel.update(l => (l.includes(codigo) ? l.filter(c => c !== codigo) : [...l, codigo]));
  }

  private corpo(p: Plano): SalvarPlano {
    return { codigo: p.codigo, nome: p.nome, descricao: p.descricao ?? null, modulos: p.modulos, limites: p.limites, padrao: p.padrao };
  }

  salvar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const limites: Record<string, number> = {};
    for (const [codigo, valor] of Object.entries(v.limites)) {
      if (valor !== null && valor !== undefined && `${valor}` !== '') limites[codigo] = Number(valor);
    }
    const corpo: SalvarPlano = {
      codigo: v.codigo!.trim(),
      nome: v.nome!.trim(),
      descricao: v.descricao?.trim() || null,
      modulos: this.modulosSel(),
      limites,
      padrao: !!v.padrao
    };
    const id = this.editingId();
    this.saving.set(true);
    this.saveError.set('');
    (id !== null ? this.service.atualizar(id, corpo) : this.service.criar(corpo)).subscribe({
      next: () => {
        this.saving.set(false);
        this.modal?.hide();
        this.feedback.set(id !== null ? 'Plano atualizado.' : 'Plano criado.');
        this.carregar();
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar plano.'), { codigo: ['código'], nome: ['nome'] }));
      }
    });
  }

  async tornarPadrao(p: Plano) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Plano padrão',
      mensagem: `Tornar "${p.nome}" o plano das empresas novas?`,
      confirmar: 'Confirmar'
    });
    if (!ok) return;
    this.agindo.set(p.id);
    this.service.atualizar(p.id, { ...this.corpo(p), padrao: true }).subscribe({
      next: () => { this.agindo.set(null); this.feedback.set('Plano padrão atualizado.'); this.carregar(); },
      error: err => { this.agindo.set(null); this.erro.set(lerErroApi(err, 'Erro ao definir plano padrão.').mensagem); }
    });
  }

  async alternarAtivo(p: Plano) {
    if (p.ativo) {
      const ok = await this.confirmDialog().abrir({
        titulo: 'Desativar plano',
        mensagem: `Desativar "${p.nome}"? Empresas que já usam o plano não são afetadas.`,
        confirmar: 'Desativar',
        perigo: true
      });
      if (!ok) return;
    }
    this.agindo.set(p.id);
    this.service.definirAtivo(p.id, !p.ativo).subscribe({
      next: () => { this.agindo.set(null); this.feedback.set(p.ativo ? 'Plano desativado.' : 'Plano ativado.'); this.carregar(); },
      error: err => { this.agindo.set(null); this.erro.set(lerErroApi(err, 'Erro ao alterar o plano.').mensagem); }
    });
  }

  erroCampo(nome: 'codigo' | 'nome' | 'descricao'): string {
    const c = this.form.controls[nome];
    if (!c.touched && !c.errors?.['servidor']) return '';
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['pattern']) return 'Use 2 a 40 caracteres: minúsculas, números, hífen ou sublinhado.';
    if (c.errors?.['maxlength']) return 'Texto longo demais.';
    return '';
  }
}
