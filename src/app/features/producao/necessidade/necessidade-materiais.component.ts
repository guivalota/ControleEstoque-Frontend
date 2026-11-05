import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { NecessidadeMateriaisService } from '../../../core/services/necessidade-materiais.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { NecessidadeMaterial, PedidosGerados } from '../../../core/models/necessidade-materiais.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { formatarData } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/**
 * O que as ordens abertas ainda vão consumir × estoque × já pedido = a comprar. O fornecedor preferencial (e o prazo de
 * entrega dele) de cada material define para quem sai o pedido e até quando comprar.
 */
@Component({
  selector: 'app-necessidade-materiais',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0 me-auto">Necessidade de materiais</h1>
      @if (permissao.canCreate()) {
        <button class="btn btn-primary" [disabled]="gerando() || paraComprar().length === 0" (click)="gerar()">Gerar pedidos de compra</button>
      }
    </div>
    <p class="text-secondary small">
      Considera as ordens planejadas, liberadas e em produção. A comprar = necessário − estoque − já pedido (pedidos de compra em aberto).
    </p>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (resultado(); as r) {
      <div class="alert alert-success" role="status">
        @for (p of r.pedidos; track p.pedidoId) {
          <div>Pedido #{{ p.pedidoId }} criado para <strong>{{ p.fornecedorNome }}</strong> ({{ p.itens }} item(ns)).
            <a routerLink="/pedidos-compra">Ver pedidos de compra</a></div>
        }
        @if (r.semFornecedor.length > 0) {
          <div class="text-warning-emphasis mt-1">Sem fornecedor preferencial (ficaram de fora): {{ r.semFornecedor.join(', ') }}.</div>
        }
      </div>
    }

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else if (linhas().length === 0) {
      <p class="text-secondary">Nenhuma ordem aberta precisa de material no momento.</p>
    } @else {
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Material</th><th class="text-end">Necessário</th><th class="text-end">Estoque</th><th class="text-end">Reservado</th>
              <th class="text-end">Em pedido</th><th class="text-end">A comprar</th><th>Fornecedor preferencial</th><th>Comprar até</th>
            </tr>
          </thead>
          <tbody>
            @for (l of linhas(); track l.materialId) {
              <tr>
                <td>{{ l.materialNome }} <span class="text-secondary">({{ l.unidadeCodigo }})</span><div class="small text-secondary">{{ l.ordens }} ordem(ns)</div></td>
                <td class="text-end">{{ l.necessario | qtd }}</td>
                <td class="text-end">{{ l.estoque | qtd }}</td>
                <td class="text-end">{{ l.reservado | qtd }}</td>
                <td class="text-end">{{ l.emPedido | qtd }}</td>
                <td class="text-end"><strong [class.text-danger]="l.aComprar > 0">{{ l.aComprar | qtd }}</strong></td>
                <td>
                  @if (editando() === l.materialId) {
                    <div class="d-flex flex-wrap gap-1">
                      <select class="form-select form-select-sm w-auto" aria-label="Fornecedor" [(ngModel)]="fornecedorEscolhido">
                        <option [ngValue]="null">Escolha…</option>
                        @for (f of fornecedores.fornecedores(); track f.id) { <option [ngValue]="f.id">{{ f.razaoSocial }}</option> }
                      </select>
                      <input class="form-control form-control-sm w-auto" type="number" min="0" max="365" placeholder="dias de entrega"
                             aria-label="Dias de entrega" [(ngModel)]="prazoEscolhido" style="width: 8rem">
                      <button class="btn btn-sm btn-primary" [disabled]="!fornecedorEscolhido" (click)="salvarFornecedor(l)">Salvar</button>
                      <button class="btn btn-sm btn-outline-secondary" (click)="editando.set(null)">Cancelar</button>
                    </div>
                  } @else {
                    {{ l.fornecedorNome ?? '— sem fornecedor' }}
                    @if (l.prazoEntregaDias !== null) { <span class="text-secondary">· {{ l.prazoEntregaDias }} dia(s)</span> }
                    @if (permissao.canEdit()) {
                      <button class="btn btn-link btn-sm py-0" (click)="editar(l)">{{ l.fornecedorId ? 'Trocar' : 'Definir' }}</button>
                      @if (l.fornecedorId) { <button class="btn btn-link btn-sm py-0 text-danger" (click)="remover(l)">Remover</button> }
                    }
                  }
                </td>
                <td>
                  @if (l.comprarAte) {
                    <span [class.text-danger]="l.atrasada">{{ data(l.comprarAte) }}</span>
                    @if (l.atrasada) { <span class="badge text-bg-danger">atrasado</span> }
                  } @else { <span class="text-secondary" title="Informe o prazo da ordem e a entrega do fornecedor">—</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class NecessidadeMateriaisComponent implements OnInit {
  private service = inject(NecessidadeMateriaisService);
  private toast = inject(ToastService);
  fornecedores = inject(FornecedorService);
  permissao = inject(PermissaoService);

  linhas = signal<NecessidadeMaterial[]>([]);
  carregando = signal(true);
  gerando = signal(false);
  erro = signal('');
  resultado = signal<PedidosGerados | null>(null);
  editando = signal<number | null>(null);
  fornecedorEscolhido: number | null = null;
  prazoEscolhido: number | null = null;

  paraComprar = computed(() => this.linhas().filter(l => l.aComprar > 0));

  ngOnInit() {
    this.carregar();
    this.fornecedores.getAll().subscribe();
  }

  data(iso: string) {
    return formatarData(iso);
  }

  private falha(err: unknown, padrao: string) {
    this.erro.set(textoDoErro(lerErroApi(err, padrao), padrao));
  }

  carregar() {
    this.carregando.set(true);
    this.service.consultar().subscribe({
      next: l => { this.linhas.set(l); this.carregando.set(false); },
      error: err => { this.falha(err, 'Não foi possível carregar a necessidade de materiais.'); this.carregando.set(false); }
    });
  }

  editar(l: NecessidadeMaterial) {
    this.fornecedorEscolhido = l.fornecedorId;
    this.prazoEscolhido = l.prazoEntregaDias;
    this.editando.set(l.materialId);
  }

  salvarFornecedor(l: NecessidadeMaterial) {
    if (!this.fornecedorEscolhido) return;
    this.erro.set('');
    const prazo = this.prazoEscolhido === null || String(this.prazoEscolhido) === '' ? null : Number(this.prazoEscolhido);
    this.service.definirFornecedor(l.materialId, this.fornecedorEscolhido, prazo).subscribe({
      next: () => { this.editando.set(null); this.toast.sucesso('Fornecedor preferencial salvo.'); this.carregar(); },
      error: err => this.falha(err, 'Não foi possível salvar o fornecedor.')
    });
  }

  remover(l: NecessidadeMaterial) {
    this.erro.set('');
    this.service.removerFornecedor(l.materialId).subscribe({
      next: () => { this.toast.sucesso('Fornecedor preferencial removido.'); this.carregar(); },
      error: err => this.falha(err, 'Não foi possível remover o fornecedor.')
    });
  }

  gerar() {
    this.gerando.set(true);
    this.erro.set('');
    this.resultado.set(null);
    this.service.gerarPedidos().subscribe({
      next: r => {
        this.gerando.set(false);
        this.resultado.set(r);
        this.toast.sucesso(r.pedidos.length > 0 ? `${r.pedidos.length} pedido(s) de compra criado(s).` : 'Nenhum pedido criado.');
        this.carregar();
      },
      error: err => { this.gerando.set(false); this.falha(err, 'Não foi possível gerar os pedidos.'); }
    });
  }
}
