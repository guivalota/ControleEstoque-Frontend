import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { DepreciacaoBem, formatarMes } from '../../../core/models/imob-depreciacao.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 24;

/** Aba "Depreciação" do bem: resumo, memória de cálculo (texto pronto do servidor) e cronograma. */
@Component({
  selector: 'app-imob-bem-depreciacao',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent],
  templateUrl: './imob-bem-depreciacao.component.html'
})
export class ImobBemDepreciacaoComponent implements OnInit {
  private service = inject(ImobDepreciacaoService);

  bemId = input.required<number>();

  readonly pageSize = PAGE_SIZE;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarMes = formatarMes;

  em = new FormControl('', { nonNullable: true });
  dados = signal<DepreciacaoBem | null>(null);
  pagina = signal(1);
  loading = signal(false);
  erro = signal('');
  naoEncontrado = signal(false);

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page = this.pagina()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.doBem(this.bemId(), { em: this.em.value || undefined, page, pageSize: PAGE_SIZE }).subscribe({
      next: d => { this.dados.set(d); this.pagina.set(page); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao calcular a depreciação.').mensagem);
      }
    });
  }

  /** A linha da competência de referência fica destacada. */
  ehReferencia(competencia: string): boolean {
    const r = this.dados()?.resumo;
    return !!r && competencia.slice(0, 7) === r.em.slice(0, 7);
  }

  /** A última quota pode diferir das demais (absorve o arredondamento). */
  quotaDiferente(quota: number): boolean {
    const r = this.dados()?.resumo;
    return !!r && quota !== r.quotaMensal;
  }
}
