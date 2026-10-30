import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

@Injectable({ providedIn: 'root' })
export class PermissaoService {
  private auth = inject(AuthService);
  private empresa = inject(EmpresaAtivaService);

  role = computed(() => this.auth.currentUser()?.role);

  /** Super administrador: administra a plataforma e nunca acessa módulos de negócio (sem permissão de escrita em nada de empresa). */
  isSuperAdmin = computed(() => this.role() === 'superadmin');

  /**
   * Perfil efetivo na empresa ativa, como o servidor devolve em `perfil`
   * (plataforma: menor entre role global e vínculo; conta cliente: o do vínculo).
   * Não recombinar com a role do token: a conta cliente tem role global `leitura`.
   * Sem perfil informado pelo servidor vale a role global. Superadmin não tem perfil de negócio.
   */
  perfil = computed<ImobPerfil | undefined>(
    () => this.isSuperAdmin() ? undefined : this.empresa.ativa()?.perfil ?? (this.role() as ImobPerfil | undefined)
  );

  /** admin e operador podem criar/editar qualquer registro */
  canCreate = computed(() => this.perfil() === 'admin' || this.perfil() === 'operador');
  canEdit   = this.canCreate;

  /** somente admin pode excluir */
  canDelete = computed(() => this.perfil() === 'admin');

  /** somente admin acessa o módulo de usuários */
  canManageUsers = this.canDelete;

  /** Perfil contador (conjunto de permissões, não um degrau): só Imobilizado contábil/parâmetros, nunca Estoque nem cadastros. */
  isContador = computed(() => this.perfil() === 'contador');

  /** Estoque (módulo e telas): o contador não usa. */
  podeUsarEstoque = computed(() => !this.isContador());

  /** Categorias do Imobilizado (vida útil, residual): admin, contador e operador (legado). */
  imobCanEditCategorias = computed(() => ['admin', 'contador', 'operador'].includes(this.perfil() ?? ''));

  /** Prévia de depreciação: admin, contador e operador. */
  imobCanPreviaDepreciacao = computed(() => ['admin', 'contador', 'operador'].includes(this.perfil() ?? ''));

  /** Fechar e reabrir período de depreciação: admin e contador. */
  imobCanFecharDepreciacao = computed(() => this.perfil() === 'admin' || this.perfil() === 'contador');

  /** Estados de conservação, pesos e escalas VP/VF: admin e contador. */
  imobCanParametrizar = this.imobCanFecharDepreciacao;

  /** Imobilizado: mesmo perfil efetivo da empresa ativa. */
  perfilImob = this.perfil;

  imobCanCreate = this.canCreate;
  imobCanEdit = this.canCreate;
  imobCanDelete = this.canDelete;
}
