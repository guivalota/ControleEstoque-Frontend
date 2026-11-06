import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissaoService } from '../../../core/services/permissao.service';
import { Permissao } from '../../../core/models/permissoes';

interface ItemRelatorio {
  titulo: string;
  descricao: string;
  rota: string;
  /** Qualquer uma das permissões libera o link (OU). */
  permissoes: Permissao[];
}

/** Os relatórios que já existem no Imobilizado e os candidatos que o responsável ainda vai definir (US-27-01). */
export const RELATORIOS_EXISTENTES: ItemRelatorio[] = [
  {
    titulo: 'Depreciação',
    descricao: 'Razão, valor contábil, bens por dimensão e baixas, por competência.',
    rota: '/imobilizado/depreciacao/relatorios',
    permissoes: ['imobilizado.depreciacao-relatorios.ver']
  },
  {
    titulo: 'Inventários',
    descricao: 'Relatório e conciliação de cada contagem, abertos a partir do inventário.',
    rota: '/imobilizado/inventarios',
    permissoes: ['imobilizado.inventarios-relatorio.ver', 'imobilizado.inventarios-conciliacao.ver']
  },
  {
    titulo: 'Bens: exportação e conferência',
    descricao: 'CSV e PDF de conferência da lista de bens, com os filtros escolhidos.',
    rota: '/imobilizado/bens',
    permissoes: ['imobilizado.bens.exportar']
  }
];

/** Candidatos levantados no comparativo (DSG-29); sem ação até o responsável passar a definição. */
export const RELATORIOS_A_DECIDIR: string[] = [
  'Movimentações por período',
  'Bens por responsável e por departamento',
  'Manutenções e ordens de serviço',
  'Comparativo entre inventários'
];

@Component({
  selector: 'app-imob-relatorios',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1 class="h4 mb-3">Relatórios do Imobilizado</h1>

    <h2 class="h6 text-secondary">Disponíveis</h2>
    <div class="list-group mb-4">
      @for (r of visiveis(); track r.rota) {
        <a class="list-group-item list-group-item-action" [routerLink]="r.rota">
          <span class="fw-semibold">{{ r.titulo }}</span>
          <span class="d-block small text-secondary">{{ r.descricao }}</span>
        </a>
      } @empty {
        <div class="list-group-item text-secondary">Seu perfil não tem acesso a nenhum relatório.</div>
      }
    </div>

    <h2 class="h6 text-secondary">A decidir</h2>
    <p class="small text-secondary">Relatórios gerenciais ainda em definição. Quando forem especificados, entram aqui.</p>
    <ul class="list-group" data-testid="a-decidir">
      @for (t of aDecidir; track t) {
        <li class="list-group-item d-flex justify-content-between align-items-center">
          {{ t }} <span class="badge text-bg-secondary">Aguardando definição</span>
        </li>
      }
    </ul>
  `
})
export class ImobRelatoriosComponent {
  private permissao = inject(PermissaoService);
  readonly aDecidir = RELATORIOS_A_DECIDIR;
  readonly visiveis = computed(() => RELATORIOS_EXISTENTES.filter(r => this.permissao.pode(r.permissoes)));
}
