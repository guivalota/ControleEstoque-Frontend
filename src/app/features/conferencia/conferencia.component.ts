import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ConferenciaService } from '../../core/services/conferencia.service';
import { ProdutoService } from '../../core/services/produto.service';
import { ConferenciaResult } from '../../core/models/conferencia.model';

@Component({
  selector: 'app-conferencia',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './conferencia.component.html'
})
export class ConferenciaComponent implements OnInit {
  private conferenciaService = inject(ConferenciaService);
  private produtoService = inject(ProdutoService);

  produtos = this.produtoService.produtos;
  produtoSelecionadoId = signal<number | null>(null);
  resultado = signal<ConferenciaResult | null>(null);
  loading = signal(false);
  erro = signal('');

  ngOnInit() {
    this.produtoService.getAll().subscribe();
  }

  conferir() {
    const id = this.produtoSelecionadoId();
    if (!id) return;
    this.loading.set(true);
    this.erro.set('');
    this.resultado.set(null);

    this.conferenciaService.conferir(id).subscribe({
      next: (res) => { this.resultado.set(res); this.loading.set(false); },
      error: (err) => {
        this.erro.set(err.error?.message ?? 'Erro ao conferir produto.');
        this.loading.set(false);
      }
    });
  }

  saldoClass(saldo: number): string {
    if (saldo <= 0) return 'text-danger';
    if (saldo <= 10) return 'text-warning';
    return 'text-success';
  }
}
