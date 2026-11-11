import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ImobConferenciaService } from '../../../core/services/imob-conferencia.service';
import { ImobConferenciaDoBem } from '../../../core/models/imob-leitura.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';
import { ImobConferenciaDetalheComponent } from '../inventarios/imob-conferencia-detalhe.component';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 20;

/**
 * Aba "Conferências" da ficha do bem (E28 / US-28-03): uma linha por ciclo de reavaliação em que o bem foi conferido, do mais
 * recente para o mais antigo, para consulta e auditoria. O detalhe (esperado × encontrado, fotos de evidência e histórico de
 * edições) abre abaixo. A conferência aponta para o bem; nada aqui altera o cadastro (DSG-30 R1).
 */
@Component({
  selector: 'app-imob-bem-conferencias',
  standalone: true,
  imports: [ImobConferenciaDetalheComponent, PaginacaoComponent],
  template: `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-header bg-transparent fw-semibold">Conferências do bem</div>
      @if (erro()) { <div class="alert alert-danger py-2 m-3" role="alert">{{ erro() }}</div> }
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0" data-testid="conferencias-do-bem">
          <thead>
            <tr>
              <th>Ciclo</th><th>Data-base</th><th>Situação</th><th>Estado</th><th class="text-end">Valor de mercado</th>
              <th>Departamento</th><th>Local da leitura</th><th>Conferido por</th><th class="text-center">Fotos</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of itens(); track c.inventarioId) {
              <tr [class.table-active]="aberto() === c.inventarioId">
                <td>
                  {{ c.inventarioNome }}
                  <span class="badge bg-light text-dark border ms-1">{{ c.inventarioReavaliacao ? 'Reavaliação' : 'Contagem' }}</span>
                  @if (c.cicloConcluido) { <span class="badge bg-secondary ms-1">Concluído</span> }
                  @else { <span class="badge bg-info-subtle text-info-emphasis ms-1">Em andamento</span> }
                </td>
                <td>{{ c.dataBase ? formatarData(c.dataBase) : '—' }}</td>
                <td>
                  @if (!c.encontrado) { <span class="badge bg-light text-dark border">Não encontrado</span> }
                  @else if (c.incompleto) { <span class="badge bg-warning-subtle text-warning-emphasis">Incompleto</span> }
                  @else { <span class="badge bg-success-subtle text-success-emphasis">Completo</span> }
                </td>
                <td>{{ c.estadoNome || '—' }}</td>
                <td class="text-end">{{ c.valorMercado !== null && c.valorMercado !== undefined ? formatarMoeda(c.valorMercado) : '—' }}</td>
                <td>{{ c.departamentoNome || '—' }}</td>
                <td>{{ c.localLidoNome || '—' }}</td>
                <td>
                  @if (c.conferidoEm) { {{ c.conferidoPorNome || '—' }} <span class="text-muted small">{{ formatarDataHora(c.conferidoEm) }}</span> } @else { — }
                </td>
                <td class="text-center">
                  @if (c.qtdFotos > 0) { <span class="badge bg-light text-dark border" [attr.aria-label]="c.qtdFotos + ' foto(s)'"><i class="bi bi-camera me-1"></i>{{ c.qtdFotos }}</span> } @else { <span class="text-muted">—</span> }
                </td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm btn-outline-primary" [attr.aria-label]="'Detalhe da conferência do ciclo ' + c.inventarioNome"
                          [attr.aria-expanded]="aberto() === c.inventarioId" (click)="alternar(c.inventarioId)">
                    <i class="bi bi-search me-1"></i>Detalhe
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="10" class="text-center text-muted py-3">{{ carregando() ? 'Carregando...' : 'Este bem ainda não foi conferido em nenhum ciclo de reavaliação.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-paginacao [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="carregando()" (mudar)="carregar($event)" />
    </div>

    @if (aberto(); as inventarioId) {
      <app-imob-conferencia-detalhe [inventarioId]="inventarioId" [bemId]="bemId()"
        [podeEnviar]="podeEnviar()" [podeExcluir]="podeExcluir()" [podeEditar]="podeEnviar()"
        (alterou)="carregar()" (fechar)="aberto.set(null)" />
    }
  `
})
export class ImobBemConferenciasComponent implements OnInit {
  private service = inject(ImobConferenciaService);

  bemId = input.required<number>();
  /** `inventarios-leituras.criar` */
  podeEnviar = input(false);
  /** `inventarios-leituras.excluir` */
  podeExcluir = input(false);

  readonly pageSize = PAGE_SIZE;
  readonly formatarData = formatarData;
  readonly formatarDataHora = formatarDataHora;
  readonly formatarMoeda = formatarMoeda;

  itens = signal<ImobConferenciaDoBem[]>([]);
  total = signal(0);
  page = signal(1);
  carregando = signal(true);
  erro = signal('');
  /** Ciclo cujo detalhe está aberto; nulo = fechado. */
  aberto = signal<number | null>(null);

  ngOnInit() {
    this.carregar(1);
  }

  alternar(inventarioId: number) {
    this.aberto.set(this.aberto() === inventarioId ? null : inventarioId);
  }

  carregar(page = this.page()) {
    this.carregando.set(true);
    this.erro.set('');
    this.service.doBem(this.bemId(), page, PAGE_SIZE).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.page.set(r.page); this.carregando.set(false); },
      error: err => { this.carregando.set(false); this.erro.set(lerErroApi(err, 'Não foi possível carregar as conferências do bem.').mensagem); }
    });
  }
}
