import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImobEmpresa } from '../models/imob-empresa.model';

@Injectable({ providedIn: 'root' })
export class EmpresaAtivaService {
  private http = inject(HttpClient);

  private readonly STORAGE_KEY = 'imob.empresaId';

  empresas = signal<ImobEmpresa[]>([]);
  id = signal<number | null>(null);
  carregando = signal(false);
  carregado = signal(false);
  erroCarregar = signal(false);
  aviso = signal('');
  trocando = signal(false);

  ativa = computed(() => this.empresas().find(e => e.id === this.id()) ?? null);
  semAcesso = computed(() => this.carregado() && this.empresas().length === 0);
  precisaEscolher = computed(() => this.carregado() && this.empresas().length > 0 && this.id() === null);
  seletorAberto = computed(() => this.precisaEscolher() || this.trocando());
  podeTrocar = computed(() => this.empresas().length > 1);

  /** Recarrega `minhas-empresas` e decide a empresa ativa (restaura, auto-seleciona ou pede escolha). */
  carregar(): Observable<void> {
    this.carregando.set(true);
    this.erroCarregar.set(false);

    return this.http.get<ImobEmpresa[]>(`${environment.apiUrl}/v1/imobilizado/minhas-empresas`).pipe(
      tap(lista => {
        this.empresas.set(lista);
        this.id.set(this.escolherInicial(lista));
        this.persistir();
        this.carregado.set(true);
        this.carregando.set(false);
      }),
      map(() => undefined),
      catchError(() => {
        this.empresas.set([]);
        this.id.set(null);
        this.carregado.set(false);
        this.erroCarregar.set(true);
        this.carregando.set(false);
        return of(undefined);
      })
    );
  }

  selecionar(id: number) {
    if (!this.empresas().some(e => e.id === id)) return;
    this.id.set(id);
    this.persistir();
    this.trocando.set(false);
    this.aviso.set('');
  }

  abrirTroca() {
    if (this.podeTrocar()) this.trocando.set(true);
  }

  cancelarTroca() {
    this.trocando.set(false);
  }

  /** Chamado pelo interceptor em 403 de dados: limpa a seleção, recarrega a lista e avisa. */
  perdeuAcesso() {
    if (this.carregando()) return;
    this.id.set(null);
    this.persistir();
    this.trocando.set(false);
    this.aviso.set('Seu acesso a esta empresa foi alterado.');
    this.carregar().subscribe();
  }

  private escolherInicial(lista: ImobEmpresa[]): number | null {
    if (lista.length === 1) return lista[0].id;
    const salvo = this.lerSalvo();
    return salvo !== null && lista.some(e => e.id === salvo) ? salvo : null;
  }

  private lerSalvo(): number | null {
    try {
      const n = Number(localStorage.getItem(this.STORAGE_KEY));
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  private persistir() {
    try {
      const id = this.id();
      if (id === null) localStorage.removeItem(this.STORAGE_KEY);
      else localStorage.setItem(this.STORAGE_KEY, String(id));
    } catch { /* storage indisponível: segue só em memória */ }
  }
}
