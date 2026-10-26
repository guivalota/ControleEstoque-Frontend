import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

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
   * Imobilizado: perfil efetivo na empresa ativa, como o servidor devolve em `perfil`
   * (plataforma: menor entre role global e vínculo; conta cliente: o do vínculo).
   * Não recombinar com a role do token: a conta cliente tem role global `leitura`.
   * Sem perfil informado pelo servidor vale a role global.
   */
  perfilImob = computed<ImobPerfil | undefined>(
    () => this.empresa.ativa()?.perfil ?? (this.role() as ImobPerfil | undefined)
  );

  imobCanCreate = computed(() => this.perfilImob() === 'admin' || this.perfilImob() === 'operador');
  imobCanEdit = this.imobCanCreate;
  imobCanDelete = computed(() => this.perfilImob() === 'admin');
}
