import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ConferenciaService } from '../../core/services/conferencia.service';
import { ImpressaoService } from '../../core/services/impressao.service';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { ConferenciaResult } from '../../core/models/conferencia.model';
import { Movimentacao } from '../../core/models/movimentacao.model';

@Component({
  selector: 'app-conferencia',
  standalone: true,
  imports: [DecimalPipe, DatePipe, TitleCasePipe],
  templateUrl: './conferencia.component.html'
})
export class ConferenciaComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private impressaoService = inject(ImpressaoService);
  imprimindo = signal(false);
  private produtoService = inject(ProdutoService);
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);

  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;

  // Modo individual
  produtoSelecionadoId = signal<number | null>(null);
  filterDataInicio = signal('');
  filterDataFim = signal('');
  filterIncluirConsumoInterno = signal(false);
  resultado = signal<ConferenciaResult | null>(null);
  loading = signal(false);
  erro = signal('');
  movimentacoesProduto = signal<Movimentacao[]>([]);
  loadingMovimentos = signal(false);

  // Modo geral
  modoGeral = signal(false);
  visaoGeral = signal<ConferenciaResult[]>([]);
  loadingGeral = signal(false);
  erroGeral = signal('');
  filterGeralDataFim = signal('');
  filterGeralCategoriaId = signal<number | null>(null);
  filterGeralApenasComSaldo = signal(false);
  filterGeralAbaixoDoMinimo = signal(false);
  filterGeralIncluirConsumoInterno = signal(false);
  readonly geralPageSize = 50;
  geralPage = signal(1);
  geralHasNextPage = signal(false);
  geralTotal = signal(0);

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.categoriaService.getAll().subscribe();
  }

  alternarModo(geral: boolean) {
    this.modoGeral.set(geral);
    if (geral && !this.visaoGeral().length) {
      this.carregarVisaoGeral();
    }
  }

  carregarVisaoGeral(page = 1) {
    this.loadingGeral.set(true);
    this.erroGeral.set('');
    this.conferenciaService.getGeral({
      DataFim: this.filterGeralDataFim() || undefined,
      CategoriaId: this.filterGeralCategoriaId() ?? undefined,
      ApenasComSaldo: this.filterGeralApenasComSaldo() || undefined,
      AbaixoDoMinimo: this.filterGeralAbaixoDoMinimo() || undefined,
      IncluirConsumoInterno: this.filterGeralIncluirConsumoInterno() || undefined,
      Page: page,
      PageSize: this.geralPageSize
    }).subscribe({
      next: result => {
        this.visaoGeral.set(result.items.sort((a, b) => a.saldoAtual - b.saldoAtual || a.nome.localeCompare(b.nome)));
        this.geralPage.set(page);
        this.geralTotal.set(result.total);
        this.geralHasNextPage.set((page * this.geralPageSize) < result.total);
        this.loadingGeral.set(false);
      },
      error: () => {
        this.erroGeral.set('Erro ao carregar visão geral.');
        this.loadingGeral.set(false);
      }
    });
  }

  conferir() {
    const id = this.produtoSelecionadoId();
    if (!id) return;
    this.loading.set(true);
    this.erro.set('');
    this.resultado.set(null);
    this.movimentacoesProduto.set([]);
    this.loadingMovimentos.set(true);

    this.conferenciaService.conferir(id, {
      DataInicio: this.filterDataInicio() || undefined,
      DataFim: this.filterDataFim() || undefined,
      IncluirConsumoInterno: this.filterIncluirConsumoInterno() || undefined
    }).subscribe({
      next: res => { this.resultado.set(res); this.loading.set(false); },
      error: err => {
        this.erro.set(err.error?.message ?? 'Erro ao conferir produto.');
        this.loading.set(false);
      }
    });

    this.movimentacaoService.getByProduto(id).subscribe({
      next: movs => {
        this.movimentacoesProduto.set(
          [...movs]
            .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
            .slice(0, 10)
        );
        this.loadingMovimentos.set(false);
      },
      error: () => this.loadingMovimentos.set(false)
    });
  }

  imprimirConferencia() {
    this.imprimindo.set(true);
    this.impressaoService.gerarPdf('/v1/impressoes/conferencia-estoque', {
      DataFim: this.filterGeralDataFim() || undefined,
      CategoriaId: this.filterGeralCategoriaId() ?? undefined,
      ApenasComSaldo: this.filterGeralApenasComSaldo() || undefined,
      AbaixoDoMinimo: this.filterGeralAbaixoDoMinimo() || undefined,
      IncluirConsumoInterno: this.filterGeralIncluirConsumoInterno() || undefined
    }).subscribe({
      next: blob => { this.impressaoService.abrirPdf(blob); this.imprimindo.set(false); },
      error: () => { alert('Erro ao gerar relatório.'); this.imprimindo.set(false); }
    });
  }

  saldoClass(saldo: number): string {
    if (saldo <= 0) return 'text-danger';
    if (saldo <= 10) return 'text-warning';
    return 'text-success';
  }

  saldoBadgeClass(saldo: number): string {
    if (saldo <= 0) return 'bg-danger';
    if (saldo <= 10) return 'bg-warning text-dark';
    return 'bg-success';
  }

  tipoBadge(tipo: string): string {
    const map: Record<string, string> = {
      entrada: 'bg-success', saida: 'bg-danger', ajuste: 'bg-warning text-dark', ajuste_saida: 'bg-secondary'
    };
    return map[tipo] ?? 'bg-secondary';
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', ajuste_saida: 'Aj. Saída'
    };
    return map[tipo] ?? tipo;
  }
}
