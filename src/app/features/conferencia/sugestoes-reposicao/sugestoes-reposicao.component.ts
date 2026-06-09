import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ConferenciaService } from '../../../core/services/conferencia.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { ConferenciaResult } from '../../../core/models/conferencia.model';

@Component({
  selector: 'app-sugestoes-reposicao',
  standalone: true,
  imports: [DecimalPipe, RouterLink, RouterLinkActive],
  templateUrl: './sugestoes-reposicao.component.html'
})
export class SugestoesReposicaoComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private categoriaService = inject(CategoriaService);

  categorias = this.categoriaService.categorias;

  filterCategoriaId = signal<number | null>(null);
  sugestoes = signal<ConferenciaResult[]>([]);
  loading = signal(false);
  erro = signal('');

  ngOnInit() {
    this.categoriaService.getAll().subscribe();
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.conferenciaService.getSugestoesReposicao(this.filterCategoriaId() ?? undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: items => this.sugestoes.set(items),
        error: () => this.erro.set('Erro ao carregar sugestões de reposição.')
      });
  }

  linhaClass(saldo: number): string {
    if (saldo === 0) return 'table-danger';
    if (saldo > 0) return 'table-warning';
    return '';
  }
}
