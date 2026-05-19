import { Component, inject, OnInit, computed } from '@angular/core';
import { DecimalPipe, TitleCasePipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { TipoMovimentacao } from '../../core/models/movimentacao.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, TitleCasePipe, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private produtoService = inject(ProdutoService);
  private categoriaService = inject(CategoriaService);
  private movimentacaoService = inject(MovimentacaoService);

  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;
  movimentacoes = this.movimentacaoService.movimentacoes;

  produtosAtivos = computed(() => this.produtos().filter(p => p.ativo).length);
  categoriasAtivas = computed(() => this.categorias().filter(c => c.ativo).length);
  totalMovimentacoes = computed(() => this.movimentacoes().length);
  valorCatalogo = computed(() =>
    this.produtos()
      .filter(p => p.ativo)
      .reduce((sum, p) => sum + p.precoUnitario, 0)
  );

  ultimasMovimentacoes = computed(() => {
    const prodMap = new Map(this.produtos().map(p => [p.id, p.nome]));
    return [...this.movimentacoes()]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 10)
      .map(m => ({ ...m, produtoNome: prodMap.get(m.produtoId) }));
  });

  ngOnInit() {
    this.produtoService.getAll().subscribe();
    this.categoriaService.getAll().subscribe();
    this.movimentacaoService.getAll().subscribe();
  }

  tipoBadge(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'bg-success',
      saida: 'bg-danger',
      ajuste: 'bg-warning text-dark'
    };
    return map[tipo] ?? 'bg-secondary';
  }
}
