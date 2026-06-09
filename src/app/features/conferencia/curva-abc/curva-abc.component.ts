import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ConferenciaService } from '../../../core/services/conferencia.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { ImpressaoService } from '../../../core/services/impressao.service';
import { CurvaAbcResponse, ClasseAbc } from '../../../core/models/conferencia.model';

@Component({
  selector: 'app-curva-abc',
  standalone: true,
  imports: [DecimalPipe, RouterLink, RouterLinkActive],
  templateUrl: './curva-abc.component.html'
})
export class CurvaAbcComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private categoriaService = inject(CategoriaService);
  private impressaoService = inject(ImpressaoService);

  categorias = this.categoriaService.categorias;

  filterDataInicio = signal('');
  filterDataFim = signal('');
  filterCategoriaId = signal<number | null>(null);
  filterClasse = signal<ClasseAbc | null>(null);

  itens = signal<CurvaAbcResponse[]>([]);
  total = signal(0);
  resumo = signal<{ A: number; B: number; C: number } | null>(null);
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
    this.carregarResumo();
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  carregar(page = 1) {
    this.loading.set(true);
    this.erro.set('');
    this.conferenciaService.getCurvaAbc({
      dataInicio: this.filterDataInicio() || undefined,
      dataFim: this.filterDataFim() || undefined,
      categoriaId: this.filterCategoriaId() ?? undefined,
      classe: this.filterClasse() ?? undefined,
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
        error: () => this.erro.set('Erro ao carregar curva ABC.')
      });
  }

  carregarResumo() {
    this.conferenciaService.getCurvaAbc({
      dataInicio: this.filterDataInicio() || undefined,
      dataFim: this.filterDataFim() || undefined,
      categoriaId: this.filterCategoriaId() ?? undefined,
      pageSize: 500
    }).subscribe({
      next: result => {
        this.resumo.set({
          A: result.items.filter(i => i.classe === 'A').length,
          B: result.items.filter(i => i.classe === 'B').length,
          C: result.items.filter(i => i.classe === 'C').length
        });
      },
      error: () => {}
    });
  }

  aplicarFiltros() {
    this.carregar(1);
    if (!this.filterClasse()) this.carregarResumo();
  }

  selecionarClasse(classe: ClasseAbc | null) {
    this.filterClasse.set(classe);
    this.carregar(1);
  }

  exportarCsv() {
    this.exportando.set(true);
    this.conferenciaService.exportarCsvAbc({
      dataInicio: this.filterDataInicio() || undefined,
      dataFim: this.filterDataFim() || undefined,
      categoriaId: this.filterCategoriaId() ?? undefined,
      classe: this.filterClasse() ?? undefined
    }).pipe(finalize(() => this.exportando.set(false)))
      .subscribe({
        next: blob => this.impressaoService.baixarArquivo(blob, 'curva-abc.csv'),
        error: () => alert('Erro ao exportar CSV.')
      });
  }

  linhaStyle(classe: ClasseAbc): string {
    const map: Record<ClasseAbc, string> = { A: 'table-success', B: 'table-warning', C: 'table-secondary' };
    return map[classe];
  }

  badgeStyle(classe: ClasseAbc): string {
    const map: Record<ClasseAbc, string> = { A: 'bg-success', B: 'bg-warning text-dark', C: 'bg-secondary' };
    return `badge ${map[classe]}`;
  }
}
