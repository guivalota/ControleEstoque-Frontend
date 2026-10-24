import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobBemHistorico } from '../../../core/models/imob-bem.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarNumeroOs } from '../../../core/models/imob-ordem-servico.model';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import {
  agruparHistorico, formatarValorHistorico, rotuloCampoHistorico
} from '../../../core/utils/historico-formato';

const PAGE_SIZE = 20;

/** Linha do tempo das alterações de um bem (somente leitura), com "carregar mais". */
@Component({
  selector: 'app-imob-bem-historico',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './imob-bem-historico.component.html'
})
export class ImobBemHistoricoComponent implements OnInit {
  private service = inject(ImobBemService);

  bemId = input.required<number>();

  rotulo = rotuloCampoHistorico;
  valor = formatarValorHistorico;
  formatarDataHora = formatarDataHora;
  numeroOs = (n?: number | null) => n ? formatarNumeroOs(n) : 'OS';

  itens = signal<ImobBemHistorico[]>([]);
  total = signal(0);
  private page = 0;

  loading = signal(false);
  carregandoMais = signal(false);
  erro = signal('');
  erroMais = signal('');
  naoEncontrado = signal(false);

  grupos = computed(() => agruparHistorico(this.itens()));
  temMais = computed(() => this.itens().length < this.total());

  ngOnInit() {
    this.carregar();
  }

  /** Primeira página (ou nova tentativa após erro). */
  carregar() {
    this.page = 0;
    this.itens.set([]);
    this.total.set(0);
    this.erro.set('');
    this.naoEncontrado.set(false);
    this.loading.set(true);
    this.buscar(1, () => this.loading.set(false), msg => this.erro.set(msg));
  }

  carregarMais() {
    if (this.carregandoMais() || !this.temMais()) return;
    this.erroMais.set('');
    this.carregandoMais.set(true);
    this.buscar(this.page + 1, () => this.carregandoMais.set(false), msg => this.erroMais.set(msg));
  }

  private buscar(page: number, fim: () => void, falha: (msg: string) => void) {
    this.service.historico(this.bemId(), page, PAGE_SIZE).subscribe({
      next: res => {
        // novas alterações durante a leitura deslocam as páginas: ignora entradas repetidas
        const jaTem = new Set(this.itens().map(e => e.id));
        this.itens.update(lista => [...lista, ...res.items.filter(e => !jaTem.has(e.id))]);
        this.total.set(res.total);
        this.page = page;
        fim();
      },
      error: err => {
        fim();
        if (err.status === 404) this.naoEncontrado.set(true);
        else falha(lerErroApi(err, 'Erro ao carregar o histórico.').mensagem);
      }
    });
  }
}
