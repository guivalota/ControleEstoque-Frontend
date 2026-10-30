import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImobEmpresa } from '../models/imob-empresa.model';

@Injectable({ providedIn: 'root' })
export class EmpresaAtivaService {
  private http = inject(HttpClient);

  /** Chave da antiga seleção de empresa (removida: um usuário, uma empresa); só se limpa o resíduo no carregamento. */
  private readonly LEGADO_KEY = 'imob.empresaId';
  /** Última empresa que o servidor acusou como bloqueada; sobrevive ao F5 para explicar a lista vazia. */
  private readonly BLOQUEIO_KEY = 'imob.empresaBloqueadaId';

  empresas = signal<ImobEmpresa[]>([]);
  id = signal<number | null>(null);
  carregando = signal(false);
  carregado = signal(false);
  erroCarregar = signal(false);
  aviso = signal('');
  /** Mensagem do servidor quando a empresa foi bloqueada (403 codigo empresa_bloqueada); some quando a lista volta com empresas. */
  bloqueadaMsg = signal('');

  ativa = computed(() => this.empresas().find(e => e.id === this.id()) ?? null);
  semAcesso = computed(() => this.carregado() && this.empresas().length === 0);
  /** Módulos liberados para a empresa ativa (vazio sem empresa ativa). */
  modulos = computed(() => this.ativa()?.modulos ?? []);
  /** Há empresa ativa, mas nenhum módulo liberado para ela. */
  semModulos = computed(() => this.ativa() !== null && this.modulos().length === 0);

  /** Usuário (sub do token) a quem pertence a lista carregada; evita reaproveitar a empresa de outra sessão. */
  private dono: string | null = null;

  temModulo(codigo: string): boolean {
    return this.modulos().includes(codigo);
  }

  /** Página inicial segura conforme os módulos: Estoque, depois Imobilizado, senão o cadastro Core de clientes (`excluir`: módulo que acabou de ser negado). */
  rotaInicial(excluir?: string): string {
    if (excluir !== 'estoque' && this.temModulo('estoque')) return '/dashboard';
    if (excluir !== 'imobilizado' && this.temModulo('imobilizado')) return '/imobilizado';
    return '/clientes';
  }

  /**
   * Garante a empresa ativa da sessão antes de ativar telas de dados: carrega uma vez por usuário
   * (0 empresas = sem acesso; 1 = ativa sozinha; D-031: um usuário, uma empresa, sem escolha).
   */
  garantirCarregada(dono: string): Observable<void> {
    if (this.carregado() && this.dono === dono) return of(undefined);
    if (this.dono !== dono) {
      this.empresas.set([]);
      this.id.set(null);
      this.carregado.set(false);
      this.dono = dono;
    }
    return this.carregar();
  }

  /** Recarrega `minhas-empresas` e define a empresa ativa: o único vínculo (se vier mais de um por dado legado, usa a primeira). */
  carregar(): Observable<void> {
    this.limparSelecaoLegada();
    this.carregando.set(true);
    this.erroCarregar.set(false);

    return this.http.get<ImobEmpresa[]>(`${environment.apiUrl}/v1/imobilizado/minhas-empresas`).pipe(
      switchMap(lista => lista.length === 0 ? this.verificarBloqueio().pipe(map(() => lista)) : of(lista)),
      tap(lista => {
        this.empresas.set(lista);
        if (lista.length > 0) { this.bloqueadaMsg.set(''); this.guardarBloqueio(null); }
        this.id.set(lista[0]?.id ?? null);
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

  /** Chamado pelo interceptor em 403 de dados: zera a empresa, recarrega a lista e avisa. */
  perdeuAcesso() {
    if (this.carregando()) return;
    this.id.set(null);
    this.aviso.set('Seu acesso a esta empresa foi alterado.');
    this.carregar().subscribe();
  }

  /**
   * 403 empresa_bloqueada numa rota de dados: o usuário cai na tela sem acesso com a mensagem do servidor.
   * Não recarrega a lista aqui (evita laço); a próxima entrada na área recarrega.
   */
  empresaBloqueada(mensagem: string) {
    this.guardarBloqueio(this.id() ?? this.lerBloqueio());
    this.bloqueadaMsg.set(mensagem);
    this.empresas.set([]);
    this.id.set(null);
    this.aviso.set('');
    this.carregado.set(true);
    this.carregando.set(false);
    this.dono = null;
  }

  /**
   * Lista vazia após uma empresa bloqueada (F5): `minhas-empresas` não diz o motivo. Uma única chamada de dados
   * com o id guardado devolve 403 empresa_bloqueada (só a conta vinculada recebe); sem ela, segue a tela genérica.
   * Não é laço: roda uma vez por carga da lista e o tratamento do 403 não recarrega.
   */
  private verificarBloqueio(): Observable<void> {
    const id = this.lerBloqueio();
    if (id === null) return of(undefined);
    return this.http.get(`${environment.apiUrl}/v1/imobilizado/empresa-ativa`, { headers: { 'X-Empresa-Id': String(id) } }).pipe(
      map(() => { this.guardarBloqueio(null); }),
      catchError(err => {
        const corpo = err?.error as { error?: unknown; codigo?: unknown } | null;
        if (err?.status === 403 && corpo?.codigo === 'empresa_bloqueada') {
          this.bloqueadaMsg.set(typeof corpo.error === 'string' && corpo.error ? corpo.error : 'Empresa bloqueada. Fale com o administrador.');
        } else {
          this.guardarBloqueio(null);
        }
        return of(undefined);
      })
    );
  }

  private lerBloqueio(): number | null {
    try {
      const n = Number(localStorage.getItem(this.BLOQUEIO_KEY));
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  private guardarBloqueio(id: number | null) {
    try {
      if (id === null) localStorage.removeItem(this.BLOQUEIO_KEY);
      else localStorage.setItem(this.BLOQUEIO_KEY, String(id));
    } catch { /* storage indisponível */ }
  }

  private limparSelecaoLegada() {
    try { localStorage.removeItem(this.LEGADO_KEY); } catch { /* storage indisponível */ }
  }
}
