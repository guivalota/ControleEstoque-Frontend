import { Component, ElementRef, OnDestroy, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ImobResponsavelService } from '../../../core/services/imob-responsavel.service';
import { ImobResponsavel } from '../../../core/models/imob-responsavel.model';
import { rotuloResponsavel } from '../../../core/utils/imob-formato';

const ATRASO_BUSCA_MS = 300;
const MAX_SUGESTOES = 20;

/**
 * Autocomplete de responsável com busca sob demanda (nunca carrega todos), compatível com
 * formulários reativos. Valor: id do responsável ou `null`. Mostra `nome (matrícula)`.
 */
@Component({
  selector: 'app-autocomplete-responsavel',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AutocompleteResponsavelComponent), multi: true }],
  template: `
    <div class="position-relative" (focusout)="aoSairDoFoco($event)">
      <div class="input-group">
        <input class="form-control" autocomplete="off" [id]="inputId()" [placeholder]="placeholder()"
               [class.is-invalid]="invalido()" [disabled]="desabilitado()" [value]="termo()"
               [attr.aria-expanded]="aberto()" aria-autocomplete="list"
               (input)="aoDigitar($any($event.target).value)" (keydown.escape)="aberto.set(false)" (focus)="aberto.set(sugestoes().length > 0)">
        @if (termo() && !desabilitado()) {
          <button type="button" class="btn btn-outline-secondary" aria-label="Limpar responsável" (click)="limpar()">
            <i class="bi bi-x-lg"></i>
          </button>
        }
      </div>
      @if (aberto()) {
        <div class="list-group position-absolute w-100 shadow-sm mt-1" style="z-index: 5; max-height: 16rem; overflow-y: auto">
          @for (r of sugestoes(); track r.id) {
            <button type="button" class="list-group-item list-group-item-action" (click)="escolher(r)">
              <span class="fw-medium">{{ rotulo(r) }}</span>
              @if (r.setor) { <small class="text-muted ms-2">{{ r.setor }}</small> }
              @if (!r.ativo) { <span class="badge bg-secondary-subtle text-secondary ms-2">Inativo</span> }
            </button>
          } @empty {
            <div class="list-group-item text-muted small">
              {{ erroBusca() ? 'Erro ao buscar responsáveis.' : 'Nenhum responsável encontrado.' }}
            </div>
          }
        </div>
      }
      @if (buscando()) {
        <div class="form-text"><span class="spinner-border spinner-border-sm me-1"></span>Buscando...</div>
      }
    </div>
  `
})
export class AutocompleteResponsavelComponent implements ControlValueAccessor, OnDestroy {
  private service = inject(ImobResponsavelService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  inputId = input('');
  placeholder = input('Buscar por nome, matrícula ou e-mail');
  /** Só responsáveis ativos nas sugestões (padrão para novas atribuições). */
  somenteAtivos = input(true);
  invalido = input(false);

  rotulo = rotuloResponsavel;
  valor = signal<number | null>(null);
  termo = signal('');
  sugestoes = signal<ImobResponsavel[]>([]);
  aberto = signal(false);
  buscando = signal(false);
  erroBusca = signal(false);
  desabilitado = signal(false);

  private busca$ = new Subject<string>();
  private sub: Subscription;
  private onChange: (v: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.sub = this.busca$.pipe(
      debounceTime(ATRASO_BUSCA_MS),
      distinctUntilChanged(),
      switchMap(texto => {
        if (!texto.trim()) return of({ items: [] as ImobResponsavel[] });
        this.buscando.set(true);
        return this.service.listar({
          busca: texto.trim(), ativo: this.somenteAtivos() ? true : undefined, pageSize: MAX_SUGESTOES
        }).pipe(catchError(() => of(null)));
      })
    ).subscribe(res => {
      this.buscando.set(false);
      this.erroBusca.set(res === null);
      this.sugestoes.set(res?.items ?? []);
      this.aberto.set(!!this.termo().trim() && this.valor() === null);
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  aoDigitar(texto: string) {
    this.termo.set(texto);
    if (this.valor() !== null) {
      this.valor.set(null);
      this.onChange(null);
    }
    if (!texto.trim()) this.aberto.set(false);
    this.busca$.next(texto);
  }

  escolher(r: ImobResponsavel) {
    this.valor.set(r.id);
    this.termo.set(rotuloResponsavel(r));
    this.sugestoes.set([]);
    this.aberto.set(false);
    this.onChange(r.id);
    this.onTouched();
  }

  limpar() {
    this.termo.set('');
    this.sugestoes.set([]);
    this.aberto.set(false);
    if (this.valor() !== null) {
      this.valor.set(null);
      this.onChange(null);
    }
    this.busca$.next('');
  }

  aoSairDoFoco(ev: FocusEvent) {
    const destino = ev.relatedTarget as Node | null;
    if (destino && this.host.nativeElement.contains(destino)) return;
    this.aberto.set(false);
    this.onTouched();
  }

  writeValue(id: number | null): void {
    this.valor.set(id ?? null);
    this.sugestoes.set([]);
    if (id === null || id === undefined) {
      this.termo.set('');
      return;
    }
    this.termo.set(`Responsável #${id}`);
    this.service.obter(id).subscribe({
      next: r => { if (this.valor() === id) this.termo.set(rotuloResponsavel(r)); },
      error: () => undefined
    });
  }

  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.desabilitado.set(d); }
}
