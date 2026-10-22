import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { achatarArvore } from '../../../core/utils/local-arvore';

/**
 * Seletor hierárquico de local (select com recuo por nível), compatível com formulários reativos.
 * Valor: id do local ou `null` (nenhum / raiz).
 */
@Component({
  selector: 'app-seletor-local',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SeletorLocalComponent), multi: true }],
  template: `
    <select class="form-select" [id]="inputId()" [disabled]="desabilitado()"
            [class.is-invalid]="invalido()" (change)="aoMudar($any($event.target).value)" (blur)="aoTocar()">
      <option value="" [selected]="valor() === null">{{ placeholder() }}</option>
      @for (o of opcoes(); track o.id) {
        <option [value]="o.id" [selected]="valor() === o.id">{{ rotulo(o) }}</option>
      }
    </select>
  `
})
export class SeletorLocalComponent implements ControlValueAccessor {
  arvore = input<ImobLocalArvore[]>([]);
  /** Oculta este local e a sua subárvore. */
  excluirId = input<number | null>(null);
  /** Só locais ativos (o local já selecionado continua visível). */
  somenteAtivos = input(false);
  placeholder = input('(Raiz)');
  inputId = input('');
  invalido = input(false);

  valor = signal<number | null>(null);
  desabilitado = signal(false);

  opcoes = computed(() => achatarArvore(this.arvore(), this.excluirId())
    .filter(o => !this.somenteAtivos() || o.ativo || o.id === this.valor()));

  private onChange: (v: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  rotulo(o: { nome: string; codigo?: string | null; nivel: number }): string {
    return '  '.repeat(o.nivel) + o.nome + (o.codigo ? ` (${o.codigo})` : '');
  }

  aoMudar(texto: string) {
    const v = texto === '' ? null : Number(texto);
    this.valor.set(v);
    this.onChange(v);
  }

  aoTocar() {
    this.onTouched();
  }

  writeValue(v: number | null): void { this.valor.set(v ?? null); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.desabilitado.set(d); }
}
