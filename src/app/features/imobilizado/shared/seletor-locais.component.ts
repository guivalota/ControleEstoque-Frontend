import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { achatarArvore } from '../../../core/utils/local-arvore';

/** Seleção múltipla de locais (CVA de `number[]`). Marcar um local inclui os sublocais no inventário. */
@Component({
  selector: 'app-seletor-locais',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SeletorLocaisComponent), multi: true }],
  template: `
    <div class="border rounded p-2 overflow-auto" style="max-height: 16rem" role="group" [attr.aria-label]="rotulo()"
         [class.border-danger]="invalido()">
      @for (o of opcoes(); track o.id) {
        <div class="form-check" [style.margin-left.rem]="o.nivel * 1.25">
          <input class="form-check-input" type="checkbox" [id]="inputId() + '-' + o.id" [checked]="marcado(o.id)"
                 [disabled]="desabilitado()" (change)="alternar(o.id, $any($event.target).checked)" (blur)="onTouched()">
          <label class="form-check-label" [for]="inputId() + '-' + o.id">
            {{ o.nome }}@if (o.codigo) { <span class="text-muted"> ({{ o.codigo }})</span> }
          </label>
        </div>
      } @empty {
        <span class="text-muted small">Nenhum local ativo cadastrado.</span>
      }
    </div>
    <div class="form-text">Os sublocais de cada local marcado entram automaticamente.</div>
  `
})
export class SeletorLocaisComponent implements ControlValueAccessor {
  arvore = input<ImobLocalArvore[]>([]);
  inputId = input('locais');
  rotulo = input('Locais do escopo');
  invalido = input(false);

  valor = signal<number[]>([]);
  desabilitado = signal(false);

  /** Só locais ativos; um local já selecionado e inativo continua visível para poder ser desmarcado. */
  opcoes = computed(() => achatarArvore(this.arvore()).filter(o => o.ativo || this.valor().includes(o.id)));

  private onChange: (v: number[]) => void = () => undefined;
  onTouched: () => void = () => undefined;

  marcado(id: number): boolean {
    return this.valor().includes(id);
  }

  alternar(id: number, marcar: boolean) {
    const atual = this.valor();
    const novo = marcar ? (atual.includes(id) ? atual : [...atual, id]) : atual.filter(x => x !== id);
    this.valor.set(novo);
    this.onChange(novo);
  }

  writeValue(v: number[] | null): void { this.valor.set(v ?? []); }
  registerOnChange(fn: (v: number[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.desabilitado.set(d); }
}
