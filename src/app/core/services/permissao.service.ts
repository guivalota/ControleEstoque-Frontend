import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { Permissao } from '../models/permissoes';

/** Ações de consulta: um perfil que só tem estas está em "somente leitura". */
const ACOES_DE_CONSULTA = new Set(['ver', 'uso', 'historico']);

/**
 * Permissões do usuário na empresa ativa (E25, DSG-27). A única fonte é a lista `permissoes` que o servidor devolve em
 * `empresa/ativa` e `empresa/minhas` (perfil ∩ módulos liberados); telas, rotas e menu perguntam por `pode()`.
 */
@Injectable({ providedIn: 'root' })
export class PermissaoService {
  private auth = inject(AuthService);
  protected empresa = inject(EmpresaAtivaService);

  role = computed(() => this.auth.currentUser()?.role);

  /** Super administrador: administra a plataforma e nunca acessa módulos de negócio (sem permissão em nada de empresa). */
  isSuperAdmin = computed(() => this.role() === 'superadmin');

  /** Permissões efetivas na empresa ativa; vazio enquanto não há empresa ativa (nada é permitido). */
  permissoes = computed<ReadonlySet<string>>(() => {
    if (this.isSuperAdmin()) return new Set<string>();
    return new Set(this.empresa.ativa()?.permissoes ?? []);
  });

  /** Nome do perfil do usuário nesta empresa (ex.: "Cadastrador"), para mostrar na interface. */
  perfilNome = computed(() => this.empresa.ativa()?.perfilNome ?? null);

  /**
   * O usuário pode? Com uma lista, basta uma (OU). Lida dentro de `computed`/`effect`/templates, reage à troca de empresa e ao
   * recarregamento do perfil.
   */
  pode(codigo: Permissao | readonly Permissao[]): boolean {
    const lista: readonly Permissao[] = typeof codigo === 'string' ? [codigo] : codigo;
    const conjunto = this.permissoes();
    return lista.some(c => conjunto.has(c));
  }

  /** Algum módulo de negócio (`estoque`, `imobilizado`, `producao`): o usuário tem alguma tela de consulta dele? */
  podeUsarModulo(modulo: 'estoque' | 'imobilizado' | 'producao'): boolean {
    for (const c of this.permissoes()) if (c.startsWith(modulo + '.') && c.endsWith('.ver')) return true;
    return false;
  }

  /** Há empresa ativa e o perfil só consulta (nenhuma ação além de ver). */
  somenteLeitura = computed(() => {
    const conjunto = this.permissoes();
    if (this.empresa.ativa() === null || conjunto.size === 0) return false;
    return [...conjunto].every(c => ACOES_DE_CONSULTA.has(c.slice(c.lastIndexOf('.') + 1)));
  });
}
