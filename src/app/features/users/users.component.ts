import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { UsuarioEmpresaService } from '../../core/services/usuario-empresa.service';
import { UsuarioEmpresa } from '../../core/models/usuario-empresa.model';
import { UserRole } from '../../core/models/user.model';

const PAGE_SIZE = 50;

/**
 * Usuários da empresa ativa: somente leitura (`GET v1/empresa-ativa/usuarios`).
 * O CRUD de contas de empresa pertence à tela de equipe (E05); o CRUD global de `v1/users` é do painel do SA (E03).
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {
  private service = inject(UsuarioEmpresaService);

  usuarios = signal<UsuarioEmpresa[]>([]);
  loading = signal(false);
  erro = signal('');
  total = signal(0);
  page = signal(1);
  readonly pageSize = PAGE_SIZE;

  busca = '';
  /** '' = todos, 'true' = ativos, 'false' = inativos. */
  filtroAtivo = '';

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page = 1) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar({
      busca: this.busca,
      ativo: this.filtroAtivo === '' ? undefined : this.filtroAtivo === 'true',
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.usuarios.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set('Erro ao carregar os usuários da empresa.');
        this.loading.set(false);
      }
    });
  }

  limpar() {
    this.busca = '';
    this.filtroAtivo = '';
    this.carregar(1);
  }

  hasNextPage() { return this.page() * this.pageSize < this.total(); }

  roleBadge(role: UserRole): string {
    const map: Record<UserRole, string> = {
      admin: 'bg-danger',
      contador: 'bg-info',
      operador: 'bg-primary',
      leitura: 'bg-secondary'
    };
    return map[role] ?? 'bg-secondary';
  }
}
