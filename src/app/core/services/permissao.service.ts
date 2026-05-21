import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissaoService {
  private auth = inject(AuthService);

  role = computed(() => this.auth.currentUser()?.role);

  /** admin e operador podem criar/editar qualquer registro */
  canCreate = computed(() => this.role() === 'admin' || this.role() === 'operador');
  canEdit   = computed(() => this.role() === 'admin' || this.role() === 'operador');

  /** somente admin pode excluir */
  canDelete = computed(() => this.role() === 'admin');

  /** somente admin acessa o módulo de usuários */
  canManageUsers = computed(() => this.role() === 'admin');
}
