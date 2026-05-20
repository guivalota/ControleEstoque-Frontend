import { Component, inject, OnInit, computed } from '@angular/core';
import { DecimalPipe, TitleCasePipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProdutoService } from '../../core/services/produto.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { FornecedorService } from '../../core/services/fornecedor.service';
import { NotaFiscalService } from '../../core/services/nota-fiscal.service';
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
  private fornecedorService = inject(FornecedorService);
  private notaFiscalService = inject(NotaFiscalService);

  produtos = this.produtoService.produtos;
  categorias = this.categoriaService.categorias;
  movimentacoes = this.movimentacaoService.movimentacoes;
  fornecedores = this.fornecedorService.fornecedores;
  notasFiscais = this.notaFiscalService.notasFiscais;

  produtosAtivos = computed(() => this.produtos().filter(p => p.ativo).length);
  categoriasAtivas = computed(() => this.categorias().filter(c => c.ativo).length);
  totalMovimentacoes = computed(() => this.movimentacoes().length);
  valorCatalogo = computed(() =>
    this.produtos()
      .filter(p => p.ativo)
      .reduce((sum, p) => sum + p.precoUnitario, 0)
  );
  fornecedoresAtivos = computed(() => this.fornecedores().filter(f => f.ativo).length);
  totalNotasFiscais = computed(() => this.notasFiscais().length);

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
    this.fornecedorService.getAll().subscribe();
    this.notaFiscalService.getAll().subscribe();
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
