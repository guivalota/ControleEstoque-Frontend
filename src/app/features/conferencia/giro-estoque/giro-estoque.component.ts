import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ConferenciaService } from '../../../core/services/conferencia.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { ImpressaoService } from '../../../core/services/impressao.service';
import { GiroEstoqueResponse } from '../../../core/models/conferencia.model';

@Component({
  selector: 'app-giro-estoque',
  standalone: true,
  imports: [DecimalPipe, RouterLink, RouterLinkActive],
  templateUrl: './giro-estoque.component.html'
})
export class GiroEstoqueComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private categoriaService = inject(CategoriaService);
  private impressaoService = inject(ImpressaoService);

  categorias = this.categoriaService.categorias;

  filterDataInicio = signal('');
  filterDataFim = signal('');
  filterCategoriaId = signal<number | null>(null);
  filterOrdenacao = signal<'asc' | 'desc'>('asc');

  itens = signal<GiroEstoqueResponse[]>([]);
  total = signal(0);
  loading = signal(false);
  exportando = signal(false);
  erro = signal('');

  readonly pageSize = 50;
  page = signal(1);
  hasNextPage = signal(false);

  ngOnInit() {
    this.categoriaService.getAll().subscribe();
    const d = new Date();
    this.filterDataFim.set(this.isoDate(d));
    d.setFullYear(d.getFullYear() - 1);
    this.filterDataInicio.set(this.isoDate(d));
    this.carregar(1);
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  carregar(page = 1) {
    this.loading.set(true);
    this.erro.set('');
    this.conferenciaService.getGiroEstoque({
      dataInicio: this.filterDataInicio() || undefined,
      dataFim: this.filterDataFim() || undefined,
      categoriaId: this.filterCategoriaId() ?? undefined,
      ordenacao: this.filterOrdenacao(),
      page,
      pageSize: this.pageSize
    }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: result => {
          this.itens.set(result.items);
          this.total.set(result.total);
          this.page.set(page);
          this.hasNextPage.set((page * this.pageSize) < result.total);
        },
        error: () => this.erro.set('Erro ao carregar giro de estoque.')
      });
  }

  aplicarFiltros() { this.carregar(1); }

  exportarCsv() {
    this.exportando.set(true);
    this.conferenciaService.exportarCsvGiro({
      dataInicio: this.filterDataInicio() || undefined,
      dataFim: this.filterDataFim() || undefined,
      categoriaId: this.filterCategoriaId() ?? undefined,
      ordenacao: this.filterOrdenacao()
    }).pipe(finalize(() => this.exportando.set(false)))
      .subscribe({
        next: blob => this.impressaoService.baixarArquivo(blob, 'giro-estoque.csv'),
        error: () => alert('Erro ao exportar CSV.')
      });
  }

  giroTitle(giro: number | null): string {
    if (giro === null) return 'Sem saldo e sem saídas no período';
    if (giro === 0) return 'O produto tem saldo mas não girou no período';
    return `Um giro de ${giro.toFixed(2)} significa que o produto saiu ${giro.toFixed(2)}× o seu estoque médio no período`;
  }
}
