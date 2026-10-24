import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuditLogService } from '../../core/services/audit-log.service';
import { UserService } from '../../core/services/user.service';
import { ImobEmpresaService } from '../../core/services/imob-empresa.service';
import { ImobEmpresa } from '../../core/models/imob-empresa.model';
import { AuditLog } from '../../core/models/audit-log.model';

const PAGE_SIZE = 50;
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './audit-logs.component.html'
})
export class AuditLogsComponent implements OnInit {
  private auditService = inject(AuditLogService);
  private userService = inject(UserService);
  private empresaService = inject(ImobEmpresaService);

  usuarios = this.userService.users;
  empresas = signal<ImobEmpresa[]>([]);
  logs = signal<AuditLog[]>([]);
  loading = signal(false);
  erro = signal('');
  total = signal(0);
  page = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly methods = METHODS;

  // Filtros (two-way binding via ngModel)
  filterUsuarioId = '';
  filterMethod = '';
  filterEndpoint = '';
  filterEmpresaId = '';
  filterDataInicio = '';
  filterDataFim = '';

  ngOnInit() {
    this.userService.getAll().subscribe();
    this.empresaService.listar(1, 100).subscribe({ next: r => this.empresas.set(r.items), error: () => this.empresas.set([]) });
    this.carregar(1);
  }

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.auditService.getAll({
      usuarioId: this.filterUsuarioId || undefined,
      method: this.filterMethod || undefined,
      endpoint: this.filterEndpoint || undefined,
      empresaId: this.filterEmpresaId ? +this.filterEmpresaId : undefined,
      dataInicio: this.filterDataInicio || undefined,
      dataFim: this.filterDataFim || undefined,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.logs.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set('Erro ao carregar logs de auditoria.');
        this.loading.set(false);
      }
    });
  }

  limpar() {
    this.filterUsuarioId = '';
    this.filterMethod = '';
    this.filterEndpoint = '';
    this.filterEmpresaId = '';
    this.filterDataInicio = '';
    this.filterDataFim = '';
    this.carregar(1);
  }

  hasNextPage() { return this.page() * this.pageSize < this.total(); }

  methodBadge(method: string): string {
    const map: Record<string, string> = {
      GET: 'bg-primary-subtle text-primary',
      POST: 'bg-success-subtle text-success',
      PUT: 'bg-warning-subtle text-warning',
      DELETE: 'bg-danger-subtle text-danger',
      PATCH: 'bg-secondary-subtle text-secondary'
    };
    return map[method] ?? 'bg-secondary-subtle text-secondary';
  }
}
