import { Component, ElementRef, OnDestroy, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Produto } from '../../core/models/produto.model';
import { ProdutoService } from '../../core/services/produto.service';
import { ToastService } from '../../core/services/toast.service';

const ATRASO_BUSCA_MS = 300;
const MIN_CARACTERES = 2;
const MAX_SUGESTOES = 20;

/**
 * Autocomplete de produto com busca no servidor (nunca carrega o catálogo inteiro), compatível com formulários
 * reativos e `ngModel`. Valor: id do produto ou `null`. Mostra `nome (sku)`.
 */
@Component({
  selector: 'app-autocomplete-produto',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AutocompleteProdutoComponent), multi: true }],
  template: `
    <div class="position-relative" (focusout)="aoSairDoFoco($event)">
      <div class="input-group" [class.input-group-sm]="pequeno()">
        <input class="form-control" autocomplete="off" [id]="inputId()" [placeholder]="placeholder()"
               [class.is-invalid]="invalido()" [disabled]="desabilitado()" [value]="termo()"
               [attr.aria-expanded]="aberto()" aria-autocomplete="list"
               (input)="aoDigitar($any($event.target).value)" (keydown.escape)="aberto.set(false)"
               (focus)="aberto.set(sugestoes().length > 0 && valor() === null)">
        @if (termo() && !desabilitado()) {
          <button type="button" class="btn btn-outline-secondary" aria-label="Limpar produto" (click)="limpar()">
            <i class="bi bi-x-lg"></i>
          </button>
        }
      </div>
      @if (aberto()) {
        <div class="list-group position-absolute w-100 shadow-sm mt-1" style="z-index: 5; max-height: 16rem; overflow-y: auto">
          @for (p of sugestoes(); track p.id) {
            <button type="button" class="list-group-item list-group-item-action" (click)="escolher(p)">
              <span class="fw-medium">{{ rotulo(p) }}</span>
              @if (!p.ativo) { <span class="badge bg-secondary-subtle text-secondary ms-2">Inativo</span> }
            </button>
          } @empty {
            <div class="list-group-item text-muted small">
              {{ erroBusca() ? 'Erro ao buscar produtos.' : 'Nenhum produto encontrado.' }}
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
export class AutocompleteProdutoComponent implements ControlValueAccessor, OnDestroy {
  private service = inject(ProdutoService);
  private toast = inject(ToastService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  inputId = input('');
  placeholder = input('Digite 2+ letras do nome ou SKU');
  /** Só produtos ativos que recebem movimentação (exclui o modelo de uma grade). */
  somenteMovimentaveis = input(false);
  pequeno = input(false);
  invalido = input(false);

  valor = signal<number | null>(null);
  termo = signal('');
  sugestoes = signal<Produto[]>([]);
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
      // switchMap cancela a requisição anterior quando o usuário continua digitando.
      switchMap(texto => {
        if (texto.trim().length < MIN_CARACTERES) return of({ items: [] as Produto[] });
        this.buscando.set(true);
        return this.service.buscar(texto.trim(), MAX_SUGESTOES).pipe(
          catchError(err => { this.toast.erroApi(err, 'Erro ao buscar produtos.'); return of(null); })
        );
      })
    ).subscribe(res => {
      this.buscando.set(false);
      this.erroBusca.set(res === null);
      const itens = res?.items ?? [];
      this.sugestoes.set(this.somenteMovimentaveis() ? itens.filter(p => p.ativo && !p.usaGrade) : itens);
      this.aberto.set(this.termo().trim().length >= MIN_CARACTERES && this.valor() === null);
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  rotulo(p: Produto): string {
    return p.sku ? `${p.nome} (${p.sku})` : p.nome;
  }

  aoDigitar(texto: string) {
    this.termo.set(texto);
    if (this.valor() !== null) {
      this.valor.set(null);
      this.onChange(null);
    }
    if (texto.trim().length < MIN_CARACTERES) {
      this.aberto.set(false);
      this.sugestoes.set([]);
    }
    this.busca$.next(texto);
  }

  escolher(p: Produto) {
    this.valor.set(p.id);
    this.termo.set(this.rotulo(p));
    this.sugestoes.set([]);
    this.aberto.set(false);
    this.onChange(p.id);
    this.onTouched();
  }

  /** Limpar o campo remove o filtro (valor `null`). */
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
    this.termo.set(`Produto #${id}`);
    this.service.getById(id).subscribe({
      next: p => { if (this.valor() === id) this.termo.set(this.rotulo(p)); },
      error: () => undefined
    });
  }

  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.desabilitado.set(d); }
}
