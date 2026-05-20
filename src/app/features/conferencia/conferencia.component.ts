import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConferenciaService } from '../../core/services/conferencia.service';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { ConferenciaResult } from '../../core/models/conferencia.model';
import { Movimentacao } from '../../core/models/movimentacao.model';

interface SaldoGeral {
  produtoId: number;
  nome: string;
  sku: string;
  categoria: string;
  saldo: number;
}

@Component({
  selector: 'app-conferencia',
  standalone: true,
  imports: [DecimalPipe, DatePipe, TitleCasePipe],
  templateUrl: './conferencia.component.html'
})
export class ConferenciaComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private produtoService = inject(ProdutoService);
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);

  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;

  // Modo individual
  produtoSelecionadoId = signal<number | null>(null);
  resultado = signal<ConferenciaResult | null>(null);
  loading = signal(false);
  erro = signal('');
  movimentacoesProduto = signal<Movimentacao[]>([]);
  loadingMovimentos = signal(false);

  // Modo geral
  modoGeral = signal(false);
  visaoGeral = signal<SaldoGeral[]>([]);
  loadingGeral = signal(false);
  erroGeral = signal('');

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

  carregarVisaoGeral() {
    const prods = this.produtos();
    if (!prods.length) {
      this.visaoGeral.set([]);
      return;
    }
    this.loadingGeral.set(true);
    this.erroGeral.set('');
    const catMap = new Map(this.categorias().map(c => [c.id, c.nome]));

    forkJoin(
      prods.map(p =>
        this.movimentacaoService.getSaldo(p.id).pipe(
          map(s => ({
            produtoId: p.id,
            nome: p.nome,
            sku: p.sku,
            categoria: catMap.get(p.categoriaId) ?? '—',
            saldo: s.saldo
          })),
          catchError(() => of({
            produtoId: p.id,
            nome: p.nome,
            sku: p.sku,
            categoria: catMap.get(p.categoriaId) ?? '—',
            saldo: 0
          }))
        )
      )
    ).subscribe({
      next: results => {
        this.visaoGeral.set(
          results.sort((a, b) => a.saldo - b.saldo || a.nome.localeCompare(b.nome))
        );
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

    this.conferenciaService.conferir(id).subscribe({
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
      entrada: 'bg-success', saida: 'bg-danger', ajuste: 'bg-warning text-dark'
    };
    return map[tipo] ?? 'bg-secondary';
  }
}
