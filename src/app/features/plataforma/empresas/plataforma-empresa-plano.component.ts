import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlataformaPlanoService } from '../../../core/services/plataforma-plano.service';
import { LIMITES, Plano, UsoEmpresa } from '../../../core/models/plataforma-plano.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

/** Aba Plano e limites: aplicar plano, sobrescrever limites e ver uso `{usado, limite, origem}`. */
@Component({
  selector: 'app-plataforma-empresa-plano',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  template: `
    @if (feedback()) {
      <div class="alert alert-success alert-dismissible py-2" role="status">
        {{ feedback() }}
        <button type="button" class="btn-close" aria-label="Fechar" (click)="feedback.set('')"></button>
      </div>
    }
    @if (erro()) {
      <div class="alert alert-danger py-2 d-flex justify-content-between align-items-center" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    }

    @if (loading()) {
      <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else {
      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h6 class="fw-bold">Plano</h6>
              <p class="small text-muted mb-2">Atual: <strong>{{ uso()?.planoNome || 'sem plano' }}</strong></p>
              <form [formGroup]="formPlano" (ngSubmit)="aplicarPlano()">
                <label for="plPlanoSel" class="form-label">Aplicar plano</label>
                <select id="plPlanoSel" class="form-select mb-2" formControlName="planoId">
                  <option [ngValue]="null">Sem plano</option>
                  @for (p of planos(); track p.id) {
                    <option [ngValue]="p.id">{{ p.nome }}{{ p.ativo ? '' : ' (inativo)' }}</option>
                  }
                </select>
                <div class="form-check mb-3">
                  <input id="plSincroniza" type="checkbox" class="form-check-input" formControlName="sincronizarModulos">
                  <label for="plSincroniza" class="form-check-label">Sincronizar módulos (liga os do plano e desliga os demais)</label>
                </div>
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="aplicando()">
                  @if (aplicando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                  Aplicar plano
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h6 class="fw-bold">Sobrescrever limites desta empresa</h6>
              <p class="small text-muted">Vazio = vale o limite do plano. A sobrescrita vale mais que o plano.</p>
              <form [formGroup]="formLimites" (ngSubmit)="salvarLimites()" novalidate>
                @for (l of limites; track l.codigo) {
                  <div class="mb-2">
                    <label [for]="'plLim_' + l.codigo" class="form-label mb-1">{{ l.rotulo }}</label>
                    <input [id]="'plLim_' + l.codigo" type="number" min="0" step="1" class="form-control form-control-sm"
                           [formControlName]="l.codigo" [class.is-invalid]="formLimites.get(l.codigo)?.invalid">
                    <div class="invalid-feedback">Informe um inteiro maior ou igual a zero.</div>
                  </div>
                }
                <button type="submit" class="btn btn-primary btn-sm me-2" [disabled]="salvandoLimites()">
                  @if (salvandoLimites()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                  Salvar limites
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="salvandoLimites()" (click)="removerLimites()">
                  Remover sobrescritas
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <h6 class="fw-bold mt-4">Uso x limite</h6>
      <div class="card border-0 shadow-sm">
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light">
              <tr><th class="ps-3">Recurso</th><th>Usado</th><th>Limite</th><th>Origem</th></tr>
            </thead>
            <tbody>
              @for (u of uso()?.limites ?? []; track u.codigo) {
                <tr>
                  <td class="ps-3">{{ u.descricao || u.codigo }}</td>
                  <td>{{ u.usado }}</td>
                  <td>{{ u.limite === null ? 'Ilimitado' : u.limite }}</td>
                  <td>{{ rotuloOrigem(u.origem) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="text-center text-muted py-3">Sem dados de uso</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
    <app-confirm-dialog />
  `
})
export class PlataformaEmpresaPlanoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaPlanoService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  empresaId = input.required<number>();
  readonly limites = LIMITES;

  planos = signal<Plano[]>([]);
  uso = signal<UsoEmpresa | null>(null);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  aplicando = signal(false);
  salvandoLimites = signal(false);

  formPlano = this.fb.group({
    planoId: this.fb.control<number | null>(null),
    sincronizarModulos: [true]
  });
  formLimites = this.fb.group({
    max_usuarios: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    max_bens: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    max_produtos: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)])
  });

  ngOnInit() {
    this.carregar();
  }

  rotuloOrigem(o: string): string {
    return o === 'empresa' ? 'Sobrescrito na empresa' : o === 'plano' ? 'Plano' : o === 'ilimitado' ? 'Ilimitado' : o;
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    let pendentes = 2;
    let falhou = false;
    const fim = () => { if (--pendentes === 0) this.loading.set(false); };
    const falha = (err: unknown, msg: string) => {
      if (!falhou) this.erro.set(lerErroApi(err, msg).mensagem);
      falhou = true;
      fim();
    };
    this.service.listar().subscribe({
      next: p => { this.planos.set(p); fim(); },
      error: err => falha(err, 'Erro ao carregar planos.')
    });
    this.service.uso(this.empresaId()).subscribe({
      next: u => {
        this.uso.set(u);
        this.formPlano.patchValue({ planoId: u.planoId ?? null });
        const sobrescritos: Record<string, number | null> = { max_usuarios: null, max_bens: null, max_produtos: null };
        for (const l of u.limites ?? []) if (l.origem === 'empresa') sobrescritos[l.codigo] = l.limite;
        this.formLimites.reset(sobrescritos);
        fim();
      },
      error: err => falha(err, 'Erro ao carregar o uso da empresa.')
    });
  }

  async aplicarPlano() {
    const v = this.formPlano.getRawValue();
    const plano = this.planos().find(p => p.id === v.planoId);
    const ok = await this.confirmDialog().abrir({
      titulo: 'Aplicar plano',
      mensagem: `Aplicar ${plano ? `o plano "${plano.nome}"` : 'a opção "sem plano"'} à empresa?`
        + (v.sincronizarModulos ? ' Os módulos serão sincronizados: ligados os do plano e desligados os demais.' : ' Os módulos atuais serão mantidos.'),
      confirmar: 'Aplicar'
    });
    if (!ok) return;
    this.aplicando.set(true);
    this.service.definirPlanoDaEmpresa(this.empresaId(), { planoId: v.planoId ?? null, sincronizarModulos: !!v.sincronizarModulos }).subscribe({
      next: () => {
        this.aplicando.set(false);
        this.feedback.set('Plano aplicado.');
        this.carregar();
      },
      error: err => {
        this.aplicando.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao aplicar o plano.').mensagem);
      }
    });
  }

  salvarLimites() {
    if (this.formLimites.invalid) { this.formLimites.markAllAsTouched(); return; }
    const v = this.formLimites.getRawValue();
    const corpo: Record<string, number> = {};
    for (const [codigo, valor] of Object.entries(v)) {
      if (valor !== null && valor !== undefined && `${valor}` !== '') corpo[codigo] = Number(valor);
    }
    this.enviarLimites(corpo, 'Limites salvos.');
  }

  removerLimites() {
    this.enviarLimites({}, 'Sobrescritas removidas.');
  }

  private enviarLimites(corpo: Record<string, number>, sucesso: string) {
    this.salvandoLimites.set(true);
    this.erro.set('');
    this.service.definirLimitesDaEmpresa(this.empresaId(), corpo).subscribe({
      next: () => {
        this.salvandoLimites.set(false);
        this.feedback.set(sucesso);
        this.carregar();
      },
      error: err => {
        this.salvandoLimites.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao salvar limites.').mensagem);
      }
    });
  }
}
