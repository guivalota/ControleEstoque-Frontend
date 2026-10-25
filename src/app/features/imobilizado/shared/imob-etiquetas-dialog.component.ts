import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Modal } from 'bootstrap';
import { ImobEtiquetaService } from '../../../core/services/imob-etiqueta.service';
import {
  ImobEtiquetaAlvo, ImobEtiquetaModelo, LIMITE_ETIQUETAS, MODELO_ETIQUETA_PADRAO
} from '../../../core/models/imob-etiqueta.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';

/** Diálogo de impressão de etiquetas: modelo, bordas, pré-visualização do PDF e download. */
@Component({
  selector: 'app-imob-etiquetas-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="etqTitulo" aria-hidden="true"
         (hidden.bs.modal)="aoFechar()">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="etqTitulo"><i class="bi bi-qr-code me-2"></i>Imprimir etiquetas</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3 align-items-end mb-3">
              <div class="col-12 col-md-7">
                <label for="etqModelo" class="form-label small mb-1">Modelo</label>
                <select id="etqModelo" class="form-select form-select-sm" [ngModel]="modelo()"
                        (ngModelChange)="mudarModelo($event)" [disabled]="!modelos().length">
                  @for (m of modelos(); track m.codigo) {
                    <option [value]="m.codigo">{{ m.descricao }}</option>
                  }
                </select>
              </div>
              <div class="col-12 col-md-5">
                <div class="form-check">
                  <input id="etqBordas" class="form-check-input" type="checkbox" [ngModel]="bordas()"
                         (ngModelChange)="mudarBordas($event)">
                  <label for="etqBordas" class="form-check-label small">Mostrar bordas (para testar em papel comum)</label>
                </div>
              </div>
            </div>

            @if (excedeLimite()) {
              <div class="alert alert-warning py-2 small" role="alert">
                O filtro tem {{ alvo()!.total }} bens e o limite é de {{ limite }} etiquetas por pedido.
                Refine os filtros antes de imprimir.
              </div>
            }
            @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }

            <div class="border rounded bg-body-tertiary" style="height: 55vh">
              @if (gerando()) {
                <div class="h-100 d-flex align-items-center justify-content-center text-muted">
                  <div class="spinner-border spinner-border-sm me-2"></div>Gerando PDF...
                </div>
              } @else if (previa()) {
                <iframe class="w-100 h-100 border-0" title="Pré-visualização das etiquetas" [src]="previa()!"></iframe>
              } @else {
                <div class="h-100 d-flex align-items-center justify-content-center text-muted small">
                  Sem pré-visualização.
                </div>
              }
            </div>
            <p class="text-muted small mt-2 mb-0">
              <i class="bi bi-info-circle me-1"></i>Imprima a 100 % (sem "ajustar à página"). Teste com bordas em papel
              comum antes de usar a folha adesiva. O QR contém somente a plaqueta.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>
            <button type="button" class="btn btn-outline-primary" [disabled]="!blob() || gerando()" (click)="abrirNovaAba()">
              <i class="bi bi-box-arrow-up-right me-1"></i>Abrir em nova aba
            </button>
            <button type="button" class="btn btn-primary" [disabled]="!blob() || gerando()" (click)="baixar()">
              <i class="bi bi-download me-1"></i>Baixar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImobEtiquetasDialogComponent implements OnDestroy {
  private service = inject(ImobEtiquetaService);
  private sanitizer = inject(DomSanitizer);
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;
  private urlBlob: string | null = null;
  private modelosCarregados = false;

  readonly limite = LIMITE_ETIQUETAS;
  modelos = signal<ImobEtiquetaModelo[]>([]);
  modelo = signal(MODELO_ETIQUETA_PADRAO);
  bordas = signal(false);
  alvo = signal<ImobEtiquetaAlvo | null>(null);

  gerando = signal(false);
  erro = signal('');
  blob = signal<Blob | null>(null);
  previa = signal<SafeResourceUrl | null>(null);

  /** A lista de modelos é buscada na primeira abertura. */
  private carregarModelos() {
    if (this.modelosCarregados) return;
    this.modelosCarregados = true;
    this.service.modelos().subscribe({
      next: m => {
        this.modelos.set(m);
        if (m.length && !m.some(x => x.codigo === this.modelo())) this.modelo.set(m[0].codigo);
      },
      error: () => undefined // sem a lista o padrão do servidor (a4-21) continua valendo
    });
  }

  ngOnDestroy() {
    this.limparPrevia();
    this.modal?.dispose();
  }

  excedeLimite(): boolean {
    const a = this.alvo();
    return !a?.ids?.length && (a?.total ?? 0) > this.limite;
  }

  /** Abre o diálogo e já gera a pré-visualização com o modelo atual. */
  abrir(alvo: ImobEtiquetaAlvo, modelo?: string) {
    this.carregarModelos();
    this.alvo.set(alvo);
    if (modelo) this.modelo.set(modelo);
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
    this.gerar();
  }

  mudarModelo(codigo: string) {
    this.modelo.set(codigo);
    this.gerar();
  }

  mudarBordas(valor: boolean) {
    this.bordas.set(valor);
    this.gerar();
  }

  gerar() {
    const alvo = this.alvo();
    if (!alvo) return;
    this.limparPrevia();
    this.erro.set('');
    if (this.excedeLimite()) return;
    this.gerando.set(true);
    this.service.gerar({ ...alvo, modelo: this.modelo(), bordas: this.bordas() }).subscribe({
      next: blob => {
        this.urlBlob = URL.createObjectURL(blob);
        this.blob.set(blob);
        this.previa.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.urlBlob));
        this.gerando.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao gerar as etiquetas.').mensagem);
        this.gerando.set(false);
      }
    });
  }

  baixar() {
    const blob = this.blob();
    if (blob) baixarBlob(blob, 'etiquetas.pdf');
  }

  abrirNovaAba() {
    if (this.urlBlob) window.open(this.urlBlob, '_blank', 'noopener');
  }

  aoFechar() {
    this.limparPrevia();
    this.erro.set('');
  }

  private limparPrevia() {
    if (this.urlBlob) URL.revokeObjectURL(this.urlBlob);
    this.urlBlob = null;
    this.blob.set(null);
    this.previa.set(null);
  }
}
