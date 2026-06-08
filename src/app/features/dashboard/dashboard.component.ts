import { Component, inject, OnInit, computed, signal, DestroyRef } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { interval } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardService } from '../../core/services/dashboard.service';
import { MovimentacaoService } from '../../core/services/movimentacao.service';
import { ProdutoService } from '../../core/services/produto.service';
import { DashboardResponse } from '../../core/models/dashboard.model';
import { TipoMovimentacao } from '../../core/models/movimentacao.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private movimentacaoService = inject(MovimentacaoService);
  private produtoService = inject(ProdutoService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  dashboard = signal<DashboardResponse | null>(null);
  loading = signal(false);

  private produtos = this.produtoService.produtos;
  private movimentacoes = this.movimentacaoService.movimentacoes;

  ultimasMovimentacoes = computed(() => {
    const prodMap = new Map(this.produtos().map(p => [p.id, p.nome]));
    return [...this.movimentacoes()]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 10)
      .map(m => ({ ...m, produtoNome: prodMap.get(m.produtoId) }));
  });

  ngOnInit() {
    this.carregarDashboard();
    this.movimentacaoService.getAll().subscribe();
    this.produtoService.getAll().subscribe();

    interval(60000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.carregarDashboard());
  }

  carregarDashboard() {
    this.loading.set(true);
    this.dashboardService.get()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(data => this.dashboard.set(data));
  }

  irParaAbaixoDoMinimo() {
    this.router.navigate(['/conferencia'], { queryParams: { abaixoDoMinimo: true } });
  }

  irParaReposicao() {
    this.router.navigate(['/conferencia/sugestoes']);
  }

  tipoBadge(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'bg-success',
      saida: 'bg-danger',
      ajuste: 'bg-warning text-dark',
      ajuste_saida: 'bg-secondary'
    };
    return map[tipo] ?? 'bg-secondary';
  }

  tipoLabel(tipo: TipoMovimentacao): string {
    const map: Record<TipoMovimentacao, string> = {
      entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', ajuste_saida: 'Aj. Saída'
    };
    return map[tipo] ?? tipo;
  }
}
