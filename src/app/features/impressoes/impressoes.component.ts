import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImpressaoService } from '../../core/services/impressao.service';
import { UserService } from '../../core/services/user.service';
import { Impressao } from '../../core/models/impressao.model';

const PAGE_SIZE = 50;

const TIPO_LABELS: Record<string, string> = {
  pedido_compra: 'Pedido de Compra'
};

@Component({
  selector: 'app-impressoes',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './impressoes.component.html'
})
export class ImpressoesComponent implements OnInit {
  private impressaoService = inject(ImpressaoService);
  private userService = inject(UserService);

  usuarios = this.userService.users;
  historico = signal<Impressao[]>([]);
  loading = signal(false);
  erro = signal('');
  total = signal(0);
  page = signal(1);
  readonly pageSize = PAGE_SIZE;

  reimprimindo = signal<number | null>(null);

  filterTipo = '';
  filterUsuarioId = '';
  filterDataInicio = '';
  filterDataFim = '';

  ngOnInit() {
    this.userService.getAll().subscribe();
    this.carregar(1);
  }

  carregar(page = 1) {
    this.loading.set(true);
    this.erro.set('');
    this.impressaoService.getHistorico({
      tipoDocumento: this.filterTipo || undefined,
      usuarioId: this.filterUsuarioId || undefined,
      dataInicio: this.filterDataInicio || undefined,
      dataFim: this.filterDataFim || undefined,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.historico.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set('Erro ao carregar histórico de impressões.');
        this.loading.set(false);
      }
    });
  }

  limpar() {
    this.filterTipo = '';
    this.filterUsuarioId = '';
    this.filterDataInicio = '';
    this.filterDataFim = '';
    this.carregar(1);
  }

  reimprimir(item: Impressao) {
    if (item.tipoDocumento !== 'pedido_compra') return;
    this.reimprimindo.set(item.id);
    this.impressaoService.imprimirPedido(item.documentoId).subscribe({
      next: blob => { this.impressaoService.abrirPdf(blob); this.reimprimindo.set(null); },
      error: () => { alert('Erro ao reimprimir.'); this.reimprimindo.set(null); }
    });
  }

  rotaDocumento(item: Impressao): string {
    if (item.tipoDocumento === 'pedido_compra') return `/pedidos-compra/${item.documentoId}`;
    return '';
  }

  tipoLabel(tipo: string): string {
    return TIPO_LABELS[tipo] ?? tipo;
  }

  hasNextPage() { return this.page() * this.pageSize < this.total(); }
}
