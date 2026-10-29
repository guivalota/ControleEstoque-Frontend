import { Component, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';
import { Modal } from 'bootstrap';

export interface SenhaProvisoriaDados {
  titulo: string;
  /** Texto de contexto (ex.: quem recebeu a senha). */
  descricao?: string;
  senha: string;
}

/**
 * Exibe uma senha provisória UMA vez (criação/redefinição de conta). A senha vive só em memória enquanto o modal
 * está aberto e é descartada ao fechar; nunca é persistida nem reexibida.
 */
@Component({
  selector: 'app-senha-provisoria-modal',
  standalone: true,
  template: `
    <div class="modal fade" #modalEl tabindex="-1" aria-labelledby="senhaProvTitulo" aria-hidden="true"
         data-bs-backdrop="static" (hidden.bs.modal)="aoFechar()">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="senhaProvTitulo">{{ titulo() }}</h5>
            <button type="button" class="btn-close" aria-label="Fechar" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            @if (descricao()) { <p class="mb-2">{{ descricao() }}</p> }
            @if (senha(); as s) {
              <label for="senhaProvCampo" class="form-label">Senha provisória</label>
              <div class="input-group mb-2">
                <input id="senhaProvCampo" class="form-control font-monospace" [value]="s" readonly>
                <button type="button" class="btn btn-outline-secondary" (click)="copiar(s)">
                  <i class="bi bi-clipboard me-1"></i>{{ copiada() ? 'Copiada' : 'Copiar' }}
                </button>
              </div>
            }
            @if (erroCopia()) { <div class="text-danger small mb-2" role="alert">{{ erroCopia() }}</div> }
            <div class="alert alert-warning py-2 mb-0" role="alert">
              <i class="bi bi-exclamation-triangle me-1"></i>
              Esta senha é exibida somente agora e não poderá ser consultada depois. Repasse-a por um canal seguro;
              o usuário deverá trocá-la no primeiro acesso.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Concluir</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SenhaProvisoriaModalComponent implements OnDestroy {
  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;

  /** Emitido quando o modal fecha (a senha já foi descartada). */
  fechado = output<void>();

  titulo = signal('');
  descricao = signal('');
  senha = signal<string | null>(null);
  copiada = signal(false);
  erroCopia = signal('');

  ngOnDestroy() {
    this.senha.set(null);
    this.modal?.dispose();
  }

  abrir(d: SenhaProvisoriaDados) {
    this.titulo.set(d.titulo);
    this.descricao.set(d.descricao ?? '');
    this.senha.set(d.senha);
    this.copiada.set(false);
    this.erroCopia.set('');
    this.modal ??= new Modal(this.modalEl().nativeElement);
    this.modal.show();
  }

  async copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      this.copiada.set(true);
      this.erroCopia.set('');
    } catch {
      this.erroCopia.set('Não foi possível copiar; selecione e copie manualmente.');
    }
  }

  aoFechar() {
    this.senha.set(null);
    this.copiada.set(false);
    this.erroCopia.set('');
    this.fechado.emit();
  }
}
