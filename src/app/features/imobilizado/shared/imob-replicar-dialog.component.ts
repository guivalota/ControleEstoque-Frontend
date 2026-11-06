import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobBem, ReplicarImobBemResultado } from '../../../core/models/imob-bem.model';
import { gerarSequencia, lerListaPlaquetas, sugerirSequencia, validarPlaquetas } from '../../../core/utils/imob-replicacao';
import { lerErroApi } from '../../../core/utils/erros-api';

type Modo = 'sequencia' | 'lista';

/**
 * Replicar bem (E27 / US-27-02): cria N cópias com plaquetas novas, tudo ou nada. Duas formas de informar as plaquetas —
 * sequência (prefixo + número + largura) ou lista —, com prévia. O servidor confere colisão e limite do plano.
 */
@Component({
  selector: 'app-imob-replicar-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="replicarTitulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <form (submit)="$event.preventDefault(); confirmar()">
            <div class="modal-header">
              <h5 class="modal-title" id="replicarTitulo">Replicar bem {{ origem()?.plaqueta }}</h5>
              <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="small text-secondary">
                Cria cópias com a mesma categoria, local, responsável, valores e fornecedor. A plaqueta, o código anterior e o
                número de série não são copiados. Se alguma plaqueta já existir, nada é criado.
              </p>

              <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Forma de informar as plaquetas">
                <button type="button" class="btn" [class.btn-primary]="modo() === 'sequencia'" [class.btn-outline-primary]="modo() !== 'sequencia'" (click)="modo.set('sequencia')">Sequência</button>
                <button type="button" class="btn" [class.btn-primary]="modo() === 'lista'" [class.btn-outline-primary]="modo() !== 'lista'" (click)="modo.set('lista')">Lista de plaquetas</button>
              </div>

              @if (modo() === 'sequencia') {
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label small mb-1" for="repQtd">Quantidade de cópias</label>
                    <input id="repQtd" type="number" min="1" max="500" class="form-control form-control-sm" name="quantidade" [(ngModel)]="quantidade">
                  </div>
                  <div class="col-6">
                    <label class="form-label small mb-1" for="repPrefixo">Prefixo</label>
                    <input id="repPrefixo" type="text" maxlength="40" class="form-control form-control-sm" name="prefixo" [(ngModel)]="prefixo">
                  </div>
                  <div class="col-6">
                    <label class="form-label small mb-1" for="repInicio">Número inicial</label>
                    <input id="repInicio" type="number" min="0" class="form-control form-control-sm" name="inicio" [(ngModel)]="numeroInicial">
                  </div>
                  <div class="col-6">
                    <label class="form-label small mb-1" for="repLargura">Dígitos (zeros à esquerda)</label>
                    <input id="repLargura" type="number" min="0" max="10" class="form-control form-control-sm" name="largura" [(ngModel)]="largura">
                  </div>
                </div>
              } @else {
                <label class="form-label small mb-1" for="repLista">Plaquetas (uma por linha)</label>
                <textarea id="repLista" rows="5" class="form-control form-control-sm" name="lista" [(ngModel)]="texto"></textarea>
              }

              @let p = plaquetas();
              <p class="small mt-3 mb-1" data-testid="previa">
                @if (p.length === 0) { <span class="text-secondary">Nenhuma cópia a criar.</span> }
                @else if (p.length <= 4) { <strong>{{ p.length }}</strong> {{ p.length === 1 ? 'cópia' : 'cópias' }}: {{ p.join(', ') }} }
                @else { <strong>{{ p.length }}</strong> cópias: {{ p[0] }}, {{ p[1] }} … {{ p[p.length - 1] }} }
              </p>
              @let e = erroLocal();
              @if (e) { <div class="text-danger small" role="alert">{{ e }}</div> }
              @if (erro()) { <div class="alert alert-danger py-2 mt-2 mb-0" role="alert">{{ erro() }}</div> }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="salvando() || !!erroLocal()">
                @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                Criar {{ plaquetas().length || '' }} {{ plaquetas().length === 1 ? 'cópia' : 'cópias' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class ImobReplicarDialogComponent implements OnDestroy {
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;
  private service = inject(ImobBemService);

  /** Emite o resultado depois que as cópias foram criadas e o diálogo fechou. */
  replicado = output<ReplicarImobBemResultado>();

  origem = signal<ImobBem | null>(null);
  modo = signal<Modo>('sequencia');
  salvando = signal(false);
  erro = signal('');

  quantidade = 1;
  prefixo = '';
  numeroInicial = 1;
  largura = 0;
  texto = '';

  abrir(bem: ImobBem) {
    this.origem.set(bem);
    const s = sugerirSequencia(bem.plaqueta);
    this.prefixo = s.prefixo;
    this.numeroInicial = s.numeroInicial;
    this.largura = s.largura;
    this.quantidade = 1;
    this.texto = '';
    this.modo.set('sequencia');
    this.erro.set('');
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  /** Plaquetas que serão criadas, conforme o modo (a mesma regra do servidor). */
  plaquetas(): string[] {
    return this.modo() === 'lista'
      ? lerListaPlaquetas(this.texto)
      : gerarSequencia({ prefixo: this.prefixo ?? '', numeroInicial: Number(this.numeroInicial) || 0, largura: Number(this.largura) || 0, quantidade: Number(this.quantidade) || 0 });
  }

  erroLocal(): string | null {
    const p = this.plaquetas();
    return p.length === 0 ? null : validarPlaquetas(p);
  }

  confirmar() {
    const p = this.plaquetas();
    const origem = this.origem();
    if (!origem || p.length === 0 || validarPlaquetas(p)) return;
    this.salvando.set(true);
    this.erro.set('');
    this.service.replicar(origem.id, { plaquetas: p }).subscribe({
      next: r => {
        this.salvando.set(false);
        this.modal?.hide();
        this.replicado.emit(r);
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(lerErroApi(err, 'Não foi possível replicar o bem.').mensagem);
      }
    });
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }
}
