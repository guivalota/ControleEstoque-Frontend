import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../../core/services/ficha-tecnica.service';
import { ProdutoService } from '../../../core/services/produto.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { FichaTecnica } from '../../../core/models/ficha-tecnica.model';
import { Produto } from '../../../core/models/produto.model';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/** Fichas técnicas vigentes (uma por produto) e atalho para criar a ficha de um produto acabado ou semiacabado. */
@Component({
  selector: 'app-fichas-tecnicas-lista',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0 me-auto">Fichas técnicas</h1>
    </div>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-5">
        <input class="form-control" type="search" placeholder="Buscar por SKU ou nome" aria-label="Buscar ficha"
               [(ngModel)]="busca" (ngModelChange)="buscarComAtraso()">
      </div>
      @if (permissao.pode('producao.fichas-tecnicas.criar')) {
        <div class="col-12 col-md-7 position-relative">
          <input class="form-control" type="search" placeholder="Nova ficha: busque o produto acabado ou semiacabado"
                 aria-label="Produto da nova ficha" [(ngModel)]="buscaProduto" (ngModelChange)="buscarProdutoComAtraso()">
          @if (candidatos().length > 0) {
            <div class="list-group position-absolute w-100 shadow-sm" style="z-index: 5">
              @for (p of candidatos(); track p.id) {
                <button type="button" class="list-group-item list-group-item-action" (click)="abrir(p.id)">
                  {{ p.sku }} — {{ p.nome }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else if (fichas().length === 0) {
      <p class="text-secondary">Nenhuma ficha técnica cadastrada.</p>
    } @else {
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>SKU</th><th>Produto</th><th class="text-end">Versão</th><th class="text-end">Materiais</th><th></th></tr></thead>
          <tbody>
            @for (f of fichas(); track f.id) {
              <tr>
                <td>{{ f.produtoSku }}</td>
                <td>{{ f.produtoNome }}</td>
                <td class="text-end">v{{ f.versao }}</td>
                <td class="text-end">{{ f.quantidadeItens }}</td>
                <td class="text-end">
                  <a class="btn btn-sm btn-outline-primary" [routerLink]="['/producao/fichas-tecnicas/produto', f.produtoId]">
                    {{ permissao.pode('producao.fichas-tecnicas.criar') ? 'Abrir' : 'Ver' }}
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-secondary">{{ total() }} ficha(s)</small>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() <= 1" (click)="irPara(pagina() - 1)">Anterior</button>
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() * TAMANHO >= total()" (click)="irPara(pagina() + 1)">Próxima</button>
        </div>
      </div>
    }
  `
})
export class FichasTecnicasListaComponent implements OnInit {
  private service = inject(FichaTecnicaService);
  private produtos = inject(ProdutoService);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  readonly TAMANHO = 20;
  fichas = signal<FichaTecnica[]>([]);
  total = signal(0);
  pagina = signal(1);
  carregando = signal(true);
  erro = signal('');
  candidatos = signal<Produto[]>([]);
  busca = '';
  buscaProduto = '';
  private timerBusca?: ReturnType<typeof setTimeout>;
  private timerProduto?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.service.listar(this.pagina(), this.TAMANHO, this.busca.trim() || undefined).subscribe({
      next: r => { this.fichas.set(r.items); this.total.set(r.total); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar as fichas.'), 'Não foi possível carregar as fichas.'));
        this.carregando.set(false);
      }
    });
  }

  irPara(pagina: number) {
    this.pagina.set(pagina);
    this.carregar();
  }

  buscarComAtraso() {
    clearTimeout(this.timerBusca);
    this.timerBusca = setTimeout(() => { this.pagina.set(1); this.carregar(); }, 300);
  }

  buscarProdutoComAtraso() {
    clearTimeout(this.timerProduto);
    const termo = this.buscaProduto.trim();
    if (termo.length < 2) { this.candidatos.set([]); return; }
    this.timerProduto = setTimeout(() => {
      this.produtos.buscar(termo, 30).subscribe(r =>
        this.candidatos.set(r.items.filter(p => (p.tipoItem === 'acabado' || p.tipoItem === 'semiacabado') && !p.produtoPaiId)));
    }, 300);
  }

  abrir(produtoId: number) {
    this.router.navigate(['/producao/fichas-tecnicas/produto', produtoId]);
  }
}
