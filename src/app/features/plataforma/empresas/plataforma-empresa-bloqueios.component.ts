import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { EmpresaBloqueio } from '../../../core/models/plataforma-empresa.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';

const PAGE_SIZE = 20;

/** Histórico de bloqueios/desbloqueios da empresa (mais recente primeiro). */
@Component({
  selector: 'app-plataforma-empresa-bloqueios',
  standalone: true,
  template: `
    @if (erro()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar(pagina())">Tentar novamente</button>
      </div>
    } @else {
      <div class="card border-0 shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr><th class="ps-3">Data/hora</th><th>Ação</th><th>Motivo</th><th>Quem</th></tr>
              </thead>
              <tbody>
                @for (b of itens(); track b.id) {
                  <tr>
                    <td class="ps-3 text-nowrap">{{ formatarDataHora(b.criadoEm) }}</td>
                    <td>
                      <span class="badge" [class.bg-danger-subtle]="b.acao === 'bloqueou'" [class.text-danger]="b.acao === 'bloqueou'"
                            [class.bg-success-subtle]="b.acao === 'desbloqueou'" [class.text-success]="b.acao === 'desbloqueou'">
                        {{ b.acao === 'bloqueou' ? 'Bloqueou' : 'Desbloqueou' }}
                      </span>
                    </td>
                    <td>{{ b.motivo || '—' }}</td>
                    <td>{{ b.atorNome }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-muted py-3">Nenhum bloqueio registrado.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <span class="text-muted small">Página {{ pagina() }} — {{ total() }} registro(s)</span>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="pagina() === 1" (click)="carregar(pagina() - 1)">Anterior</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="!temProxima()" (click)="carregar(pagina() + 1)">Próxima</button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class PlataformaEmpresaBloqueiosComponent implements OnInit {
  private service = inject(PlataformaEmpresaService);

  empresaId = input.required<number>();

  formatarDataHora = formatarDataHora;
  itens = signal<EmpresaBloqueio[]>([]);
  total = signal(0);
  pagina = signal(1);
  erro = signal('');
  temProxima = computed(() => this.pagina() * PAGE_SIZE < this.total());

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page: number) {
    this.erro.set('');
    this.service.bloqueios(this.empresaId(), page, PAGE_SIZE).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.pagina.set(page); },
      error: err => this.erro.set(lerErroApi(err, 'Erro ao carregar o histórico de bloqueios.').mensagem)
    });
  }
}
