import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { CodigoAnterior } from '../models/imob-renovacao.model';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobBemService } from './imob-bem.service';

/**
 * Estado da "virada" (código anterior oculto ou não) da empresa ativa. Carregado sob demanda e
 * compartilhado pelas telas (lista, formulário, conciliação, painel de renovação). Se a carga
 * falhar vale "não oculto": o servidor continua sendo a autoridade sobre o que devolve.
 */
@Injectable({ providedIn: 'root' })
export class ImobCodigoAnteriorService {
  private bens = inject(ImobBemService);
  private empresa = inject(EmpresaAtivaService);

  estado = signal<CodigoAnterior | null>(null);
  carregando = signal(false);
  erro = signal(false);
  /** `true` só quando a virada foi feita. */
  oculto = computed(() => this.estado()?.oculto === true);

  private empresaCarregada: number | null = null;

  /** Carrega o estado da empresa ativa; reaproveita o cache, exceto com `forcar`. */
  carregar(forcar = false) {
    const empresaId = this.empresa.id();
    if (!forcar && this.estado() && this.empresaCarregada === empresaId) return;
    if (this.carregando()) return;
    this.empresaCarregada = empresaId;
    this.estado.set(null);
    this.erro.set(false);
    this.carregando.set(true);
    this.bens.obterCodigoAnterior().subscribe({
      next: e => { this.estado.set(e); this.carregando.set(false); },
      error: () => { this.erro.set(true); this.carregando.set(false); }
    });
  }

  alterar(oculto: boolean) {
    return this.bens.definirCodigoAnterior(oculto).pipe(
      tap(e => { this.estado.set(e); this.empresaCarregada = this.empresa.id(); })
    );
  }
}
