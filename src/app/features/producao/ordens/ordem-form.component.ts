import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GradeService } from '../../../core/services/grade.service';
import { OrdemProducaoService } from '../../../core/services/ordem-producao.service';
import { ProdutoService } from '../../../core/services/produto.service';
import { ToastService } from '../../../core/services/toast.service';
import { Produto } from '../../../core/models/produto.model';
import { VariacaoGrade } from '../../../core/models/grade.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface LinhaQuantidade {
  variacaoId: number | null;
  rotulo: string;
  quantidade: number | null;
}

/**
 * Nova ordem de produção: escolhe o produto (acabado ou semiacabado) e informa a quantidade por tamanho.
 * O servidor calcula a necessidade de material pela ficha vigente; a tela de detalhe mostra o resultado.
 */
@Component({
  selector: 'app-ordem-form',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <a routerLink="/producao/ordens" class="small">← Ordens de produção</a>
    <h1 class="h4 mt-1 mb-3">Nova ordem de produção</h1>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="position-relative mb-3">
      <label class="form-label" for="produto">Produto</label>
      @if (produto()) {
        <div class="d-flex align-items-center gap-2">
          <strong>{{ produto()!.sku }} — {{ produto()!.nome }}</strong>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="trocarProduto()">Trocar</button>
        </div>
      } @else {
        <input id="produto" class="form-control" type="search" placeholder="Busque o produto acabado ou semiacabado"
               aria-label="Produto da ordem" [(ngModel)]="buscaProduto" (ngModelChange)="buscar()">
        @if (buscaProduto.trim().length >= 2 && candidatos().length === 0 && buscou()) {
          <div class="form-text">Nenhum produto acabado ou semiacabado encontrado. Confira o tipo do item no cadastro (variações da grade não entram: escolha o produto principal).</div>
        }
        @if (candidatos().length > 0) {
          <div class="list-group position-absolute w-100 shadow-sm" style="z-index: 5">
            @for (p of candidatos(); track p.id) {
              <button type="button" class="list-group-item list-group-item-action" (click)="escolher(p)">{{ p.sku }} — {{ p.nome }}</button>
            }
          </div>
        }
      }
    </div>

    @if (produto()) {
      <h2 class="h6">Quantidade a produzir</h2>
      @if (linhas().length === 0) {
        <p class="text-secondary">Este produto tem grade, mas nenhuma variação ativa. Gere a grade em Produtos antes de abrir a ordem.</p>
      } @else {
        <div class="row g-2 mb-2">
          @for (l of linhas(); track $index) {
            <div class="col-6 col-md-3 col-lg-2">
              <label class="form-label small mb-1" [for]="'q' + $index">{{ l.rotulo }}</label>
              <input [id]="'q' + $index" class="form-control form-control-sm" type="number" min="0" step="any" [ngModel]="l.quantidade" (ngModelChange)="alterarQuantidade($index, $event)"
                     [attr.aria-label]="'Quantidade ' + l.rotulo">
            </div>
          }
        </div>
        <p class="small text-secondary">Total: <strong>{{ totalPecas() | qtd }}</strong> peça(s). Deixe em branco os tamanhos que não entram.</p>
      }

      <div class="row g-2 mb-3">
        <div class="col-12 col-md-3">
          <label class="form-label" for="prazo">Prazo</label>
          <input id="prazo" class="form-control" type="date" [(ngModel)]="prazo">
        </div>
        <div class="col-12 col-md-9">
          <label class="form-label" for="obs">Observações</label>
          <input id="obs" class="form-control" maxlength="500" [(ngModel)]="observacao">
        </div>
      </div>

      <button class="btn btn-primary" [disabled]="salvando() || totalPecas() <= 0" (click)="salvar()" aria-describedby="dica-criar">Criar ordem</button>
      @if (totalPecas() <= 0 && linhas().length > 0) {
        <span id="dica-criar" class="small text-secondary ms-2">Informe a quantidade de pelo menos um tamanho para criar a ordem.</span>
      }
    }
  `
})
export class OrdemFormComponent {
  private service = inject(OrdemProducaoService);
  private produtos = inject(ProdutoService);
  private grade = inject(GradeService);
  private router = inject(Router);
  private toast = inject(ToastService);

  produto = signal<Produto | null>(null);
  candidatos = signal<Produto[]>([]);
  linhas = signal<LinhaQuantidade[]>([]);
  buscou = signal(false);
  salvando = signal(false);
  erro = signal('');
  buscaProduto = '';
  prazo = '';
  observacao = '';
  private timer?: ReturnType<typeof setTimeout>;

  totalPecas = computed(() => this.linhas().reduce((s, l) => s + (Number(l.quantidade) > 0 ? Number(l.quantidade) : 0), 0));

  buscar() {
    clearTimeout(this.timer);
    const termo = this.buscaProduto.trim();
    this.buscou.set(false);
    if (termo.length < 2) { this.candidatos.set([]); return; }
    this.timer = setTimeout(() => {
      this.produtos.buscar(termo, 30).subscribe(r => {
        this.candidatos.set(r.items.filter(p => (p.tipoItem === 'acabado' || p.tipoItem === 'semiacabado') && !p.produtoPaiId));
        this.buscou.set(true);
      });
    }, 300);
  }

  escolher(p: Produto) {
    this.produto.set(p);
    this.candidatos.set([]);
    this.erro.set('');
    if (!p.usaGrade) {
      this.linhas.set([{ variacaoId: null, rotulo: p.unidadeCodigo ?? 'un', quantidade: null }]);
      return;
    }
    this.grade.obter(p.id).subscribe({
      next: g => this.linhas.set(g.variacoes.filter((v: VariacaoGrade) => v.ativo)
        .map((v: VariacaoGrade) => ({ variacaoId: v.produtoId, rotulo: v.sku, quantidade: null }))),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar a grade.'), 'Não foi possível carregar a grade.'))
    });
  }

  /** Atualiza o signal (e não o objeto da linha), senão o total e o botão não reagem à digitação. */
  alterarQuantidade(indice: number, valor: number | null) {
    this.linhas.update(ls => ls.map((l, i) => (i === indice ? { ...l, quantidade: valor } : l)));
  }

  trocarProduto() {
    this.produto.set(null);
    this.linhas.set([]);
    this.buscaProduto = '';
  }

  salvar() {
    const p = this.produto();
    if (!p) return;
    this.salvando.set(true);
    this.erro.set('');
    this.service.criar({
      produtoId: p.id,
      prazo: this.prazo || null,
      observacao: this.observacao.trim() || null,
      itens: this.linhas().filter(l => Number(l.quantidade) > 0).map(l => ({ variacaoId: l.variacaoId, quantidade: Number(l.quantidade) }))
    }).subscribe({
      next: o => {
        this.salvando.set(false);
        this.toast.sucesso(`Ordem ${o.numero} criada.`);
        this.router.navigate(['/producao/ordens', o.id]);
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível criar a ordem.'), 'Não foi possível criar a ordem.'));
      }
    });
  }
}
