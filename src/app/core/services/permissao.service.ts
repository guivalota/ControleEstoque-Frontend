import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

const NIVEL: Record<ImobPerfil, number> = { leitura: 0, operador: 1, admin: 2 };

@Injectable({ providedIn: 'root' })
export class PermissaoService {
  private auth = inject(AuthService);
  private empresa = inject(EmpresaAtivaService);

  role = computed(() => this.auth.currentUser()?.role);

  /** admin e operador podem criar/editar qualquer registro */
  canCreate = computed(() => this.role() === 'admin' || this.role() === 'operador');
  canEdit   = computed(() => this.role() === 'admin' || this.role() === 'operador');

  /** somente admin pode excluir */
  canDelete = computed(() => this.role() === 'admin');

  /** somente admin acessa o módulo de usuários */
  canManageUsers = computed(() => this.role() === 'admin');

  /**
   * Imobilizado: perfil efetivo = menor entre a role global e o perfil na empresa ativa
   * (o perfil só restringe). Sem perfil informado pelo servidor vale a role global.
   */
  perfilImob = computed<ImobPerfil | undefined>(() => {
    const role = this.role() as ImobPerfil | undefined;
    const perfil = this.empresa.ativa()?.perfil;
    if (!role || !perfil) return role;
    return NIVEL[perfil] < NIVEL[role] ? perfil : role;
  });

  imobCanCreate = computed(() => this.perfilImob() === 'admin' || this.perfilImob() === 'operador');
  imobCanEdit = this.imobCanCreate;
  imobCanDelete = computed(() => this.perfilImob() === 'admin');
}
