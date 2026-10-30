import { Component, ElementRef, OnDestroy, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { PlataformaModuloService } from '../../../core/services/plataforma-modulo.service';
import { EmpresaModulo, EmpresaModuloEvento } from '../../../core/models/plataforma-modulo.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../../imobilizado/shared/paginacao.component';

const EVENTOS_PAGE = 20;

/** Aba Módulos: liga/desliga com motivo e histórico de eventos. */
@Component({
  selector: 'app-plataforma-empresa-modulos',
  standalone: true,
  imports: [ReactiveFormsModule, PaginacaoComponent],
  template: `
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

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-0">
        @if (loading()) {
          <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else {
          <ul class="list-group list-group-flush">
            @for (m of modulos(); track m.codigo) {
              <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                <div>
                  <strong>{{ m.nome || m.codigo }}</strong>
                  <span class="badge ms-2" [class.bg-success-subtle]="m.ativo" [class.text-success]="m.ativo"
                        [class.bg-secondary-subtle]="!m.ativo" [class.text-secondary]="!m.ativo">
                    {{ m.ativo ? 'Ligado' : 'Desligado' }}
                  </span>
                  @if (m.descricao) { <div class="small text-muted">{{ m.descricao }}</div> }
                  @if (m.dependeDe?.length) { <div class="small text-muted">Depende de: {{ m.dependeDe!.join(', ') }}</div> }
                </div>
                <button type="button" class="btn btn-sm" [class.btn-outline-danger]="m.ativo" [class.btn-outline-success]="!m.ativo"
                        (click)="abrirMotivo(m)" [disabled]="agindo() === m.codigo"
                        [attr.aria-label]="(m.ativo ? 'Desligar ' : 'Ligar ') + (m.nome || m.codigo)">
                  {{ m.ativo ? 'Desligar' : 'Ligar' }}
                </button>
              </li>
            } @empty {
              <li class="list-group-item text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Nenhum módulo no catálogo</li>
            }
          </ul>
        }
      </div>
    </div>

    <h6 class="fw-bold">Histórico de módulos</h6>
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        @if (loadingEventos()) {
          <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (erroEventos()) {
          <div class="alert alert-danger m-2 py-2" role="alert">{{ erroEventos() }}</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr><th class="ps-3">Quando</th><th>Módulo</th><th>Ação</th><th>Detalhe</th><th>Por</th></tr>
              </thead>
              <tbody>
                @for (ev of eventos(); track ev.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(ev.criadoEm) }}</td>
                    <td>{{ ev.moduloCodigo || '—' }}</td>
                    <td>{{ ev.acao || '—' }}</td>
                    <td>{{ ev.detalhe || '—' }}</td>
                    <td>{{ ev.atorNome || '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="text-center text-muted py-3">Nenhum evento registrado</td></tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacao [page]="pageEventos()" [pageSize]="eventosPageSize" [total]="totalEventos()"
                         (mudar)="carregarEventos($event)" />
        }
      </div>
    </div>

    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="plModTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" [formGroup]="form" (ngSubmit)="confirmar()" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="plModTitulo">{{ alvo()?.ativo ? 'Desligar' : 'Ligar' }} módulo {{ alvo()?.nome || alvo()?.codigo }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (saveError()) { <div class="alert alert-danger py-2" role="alert">{{ saveError() }}</div> }
            @if (alvo()?.ativo) {
              <p class="small text-muted">Desligar bloqueia o acesso ao módulo, mas nunca apaga dados.</p>
            }
            <label for="plModMotivo" class="form-label">Motivo (opcional)</label>
            <textarea id="plModMotivo" class="form-control" rows="3" maxlength="280" formControlName="motivo"
                      [class.is-invalid]="form.controls.motivo.invalid"></textarea>
            <div class="invalid-feedback">Máximo de 280 caracteres.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn" [class.btn-danger]="alvo()?.ativo" [class.btn-primary]="!alvo()?.ativo" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              {{ alvo()?.ativo ? 'Desligar' : 'Ligar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class PlataformaEmpresaModulosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(PlataformaModuloService);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;

  empresaId = input.required<number>();
  readonly eventosPageSize = EVENTOS_PAGE;
  formatarDataHora = formatarDataHora;

  modulos = signal<EmpresaModulo[]>([]);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  agindo = signal<string | null>(null);

  eventos = signal<EmpresaModuloEvento[]>([]);
  totalEventos = signal(0);
  pageEventos = signal(1);
  loadingEventos = signal(false);
  erroEventos = signal('');

  alvo = signal<EmpresaModulo | null>(null);
  saving = signal(false);
  saveError = signal('');
  form = this.fb.group({ motivo: ['', [Validators.maxLength(280)]] });

  ngOnInit() {
    this.carregar();
    this.carregarEventos(1);
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar(this.empresaId()).subscribe({
      next: m => { this.modulos.set(m); this.loading.set(false); },
      error: err => { this.erro.set(lerErroApi(err, 'Erro ao carregar módulos.').mensagem); this.loading.set(false); }
    });
  }

  carregarEventos(page = this.pageEventos()) {
    this.loadingEventos.set(true);
    this.erroEventos.set('');
    this.service.eventos(this.empresaId(), page, EVENTOS_PAGE).subscribe({
      next: res => {
        this.eventos.set(res.items ?? []);
        this.totalEventos.set(res.total);
        this.pageEventos.set(page);
        this.loadingEventos.set(false);
      },
      error: err => { this.erroEventos.set(lerErroApi(err, 'Erro ao carregar o histórico.').mensagem); this.loadingEventos.set(false); }
    });
  }

  abrirMotivo(m: EmpresaModulo) {
    this.alvo.set(m);
    this.form.reset({ motivo: '' });
    this.saveError.set('');
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  confirmar() {
    const m = this.alvo();
    if (!m) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    const motivo = this.form.getRawValue().motivo?.trim() || null;
    this.service.definir(this.empresaId(), m.codigo, { ativo: !m.ativo, motivo }).subscribe({
      next: () => {
        this.saving.set(false);
        this.modal?.hide();
        this.feedback.set(m.ativo ? 'Módulo desligado.' : 'Módulo ligado.');
        this.carregar();
        this.carregarEventos(1);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(lerErroApi(err, 'Erro ao alterar o módulo.').mensagem);
      }
    });
  }
}
