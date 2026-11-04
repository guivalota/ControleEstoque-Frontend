import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FichaTecnicaService } from '../../../core/services/ficha-tecnica.service';
import { GradeService } from '../../../core/services/grade.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ProdutoService } from '../../../core/services/produto.service';
import { ToastService } from '../../../core/services/toast.service';
import { FichaTecnica, FichaConsumo, FichaCusto } from '../../../core/models/ficha-tecnica.model';
import { Produto, TipoItem } from '../../../core/models/produto.model';
import { VariacaoGrade } from '../../../core/models/grade.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { PrecificacaoProdutoComponent } from './precificacao-produto.component';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface LinhaFicha {
  materialId: number;
  rotulo: string;
  unidade: string;
  variacaoId: number | null;
  quantidade: number;
  perdaPercentual: number;
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

const TIPOS_MATERIAL: TipoItem[] = ['materia_prima', 'aviamento', 'embalagem', 'semiacabado', 'consumo'];

/**
 * Ficha técnica de um produto: materiais com quantidade e % de perda; a quantidade pode ser da base comum ou de uma
 * variação (tamanho). Salvar cria a PRÓXIMA versão (a anterior fica no histórico, intacta).
 */
@Component({
  selector: 'app-ficha-tecnica-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe, PrecificacaoProdutoComponent],
  template: `
    <a routerLink="/producao/fichas-tecnicas" class="small">← Fichas técnicas</a>
    <h1 class="h4 mt-1 mb-1">Ficha técnica{{ produto() ? ': ' + produto()!.nome : '' }}</h1>
    @if (produto()) {
      <p class="text-secondary small">
        {{ produto()!.sku }} ·
        {{ vigente() ? 'versão vigente v' + vigente()!.versao : 'ainda sem ficha' }}
        @if (vigente() && !permissao.canEdit()) { · somente consulta }
      </p>
    }

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else {
      @if (permissao.canEdit()) {
        <div class="position-relative mb-3">
          <input class="form-control" type="search" aria-label="Adicionar material"
                 placeholder="Adicionar material: busque por SKU ou nome" [(ngModel)]="buscaMaterial" (ngModelChange)="buscarMaterial()">
          @if (candidatos().length > 0) {
            <div class="list-group position-absolute w-100 shadow-sm" style="z-index: 5">
              @for (m of candidatos(); track m.id) {
                <button type="button" class="list-group-item list-group-item-action" (click)="adicionar(m)">
                  {{ m.sku }} — {{ m.nome }} <span class="text-secondary">({{ m.unidadeCodigo }})</span>
                </button>
              }
            </div>
          }
        </div>
      }

      @if (linhas().length === 0) {
        <p class="text-secondary">Nenhum material na ficha.</p>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Material</th>
                @if (temVariacoes()) { <th>Vale para</th> }
                <th style="width: 9rem">Quantidade</th><th style="width: 7rem">Perda %</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (l of linhas(); track $index) {
                <tr>
                  <td>{{ l.rotulo }} <span class="text-secondary">({{ l.unidade }})</span></td>
                  @if (temVariacoes()) {
                    <td>
                      <select class="form-select form-select-sm" [(ngModel)]="l.variacaoId" [disabled]="!permissao.canEdit()" aria-label="Variação">
                        <option [ngValue]="null">Todas (base comum)</option>
                        @for (v of variacoes(); track v.produtoId) { <option [ngValue]="v.produtoId">{{ v.sku }}</option> }
                      </select>
                    </td>
                  }
                  <td><input class="form-control form-control-sm" type="number" step="any" min="0" [(ngModel)]="l.quantidade"
                             [disabled]="!permissao.canEdit()" aria-label="Quantidade"></td>
                  <td><input class="form-control form-control-sm" type="number" step="any" min="0" max="99.99" [(ngModel)]="l.perdaPercentual"
                             [disabled]="!permissao.canEdit()" aria-label="Perda percentual"></td>
                  <td class="text-end">
                    @if (permissao.canEdit()) {
                      <button type="button" class="btn btn-sm btn-outline-danger" (click)="remover($index)" aria-label="Remover material">Remover</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (permissao.canEdit()) {
        <div class="mb-3">
          <label class="form-label" for="obs">Observação da versão</label>
          <input id="obs" class="form-control" maxlength="500" [(ngModel)]="observacao">
        </div>
        <div class="row g-2 mb-3">
          <div class="col-6 col-md-3">
            <label class="form-label" for="mdo">Mão de obra por peça (R$)</label>
            <input id="mdo" class="form-control" type="number" step="any" min="0" [(ngModel)]="maoDeObra">
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label" for="ind">Custos indiretos por peça (R$)</label>
            <input id="ind" class="form-control" type="number" step="any" min="0" [(ngModel)]="custosIndiretos">
          </div>
        </div>
        <button class="btn btn-primary" [disabled]="salvando() || linhas().length === 0" (click)="salvar()">
          {{ vigente() ? 'Salvar como nova versão' : 'Criar ficha' }}
        </button>
      }

      @if (vigente()) {
        <hr>
        <h2 class="h6">Consumo por peça (com perda)</h2>
        @if (temVariacoes()) {
          <select class="form-select form-select-sm w-auto mb-2" [(ngModel)]="variacaoConsulta" (ngModelChange)="carregarConsumo()" aria-label="Variação do consumo">
            <option [ngValue]="null">Base comum</option>
            @for (v of variacoes(); track v.produtoId) { <option [ngValue]="v.produtoId">{{ v.sku }}</option> }
          </select>
        }
        <ul class="list-unstyled small mb-3">
          @for (c of consumo(); track c.materialId) {
            <li>{{ c.materialNome }}: {{ c.quantidade | qtd }} {{ c.unidadeCodigo }}
              @if (c.perdaPercentual > 0) { + {{ c.perdaPercentual | qtd }}% de perda = <strong>{{ c.quantidadeComPerda | qtd }} {{ c.unidadeCodigo }}</strong> }
              @if (c.propriaDaVariacao) { <span class="badge text-bg-secondary">próprio deste tamanho</span> }
            </li>
          }
        </ul>
      }

      @if (vigente() && custo(); as c) {
        <h2 class="h6">Custo padrão por peça</h2>
        <p class="small text-secondary mb-1">Pelo custo médio ponderado de hoje dos materiais, mais mão de obra e custos indiretos.</p>
        @if (!c.completo) {
          <div class="alert alert-warning small py-2" role="alert">
            Sem custo conhecido para: {{ c.materiaisSemCusto.join(', ') }}. O total só aparece quando todos tiverem custo (dê entrada com valor no Estoque).
          </div>
        }
        <ul class="list-unstyled small mb-1">
          @for (m of c.materiais; track m.materialId) {
            <li>{{ m.materialNome }}: {{ m.quantidadeComPerda | qtd }} {{ m.unidadeCodigo }} ×
              {{ m.custoUnitario === null ? 'sem custo' : moeda(m.custoUnitario) }} =
              <strong>{{ m.custo === null ? '—' : moeda(m.custo) }}</strong></li>
          }
          <li>Mão de obra: {{ moeda(c.maoDeObra) }} · Custos indiretos: {{ moeda(c.custosIndiretos) }}</li>
        </ul>
        <p class="mb-1">{{ c.completo ? 'Custo padrão' : 'Custo parcial (incompleto)' }}:
          <strong>{{ moeda(c.completo ? c.custoTotal : c.custoParcial) }}</strong></p>
        @if (vigente()!.custoPadraoNaCriacao !== null) {
          <p class="small text-secondary">Quando esta versão foi criada: {{ moeda(vigente()!.custoPadraoNaCriacao) }}</p>
        }
      }

      @if (vigente()) {
        <app-precificacao-produto [produtoId]="produtoId" [fichaId]="vigente()!.id" />
      }

      @if (versoes().length > 0) {
        <h2 class="h6">Histórico de versões</h2>
        <ul class="small">
          @for (v of versoes(); track v.id) {
            <li>v{{ v.versao }}{{ v.vigente ? ' (vigente)' : '' }} · {{ v.quantidadeItens }} materiais · {{ v.criadoEm.slice(0, 10) }}
              @if (v.observacao) { · {{ v.observacao }} }
              @if (!v.vigente && permissao.canEdit()) { <button type="button" class="btn btn-link btn-sm py-0" (click)="carregarVersao(v.id)">Usar como base</button> }
            </li>
          }
        </ul>
      }
    }
  `
})
export class FichaTecnicaEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(FichaTecnicaService);
  private produtos = inject(ProdutoService);
  private grade = inject(GradeService);
  private toast = inject(ToastService);
  permissao = inject(PermissaoService);

  produtoId = 0;
  produto = signal<Produto | null>(null);
  vigente = signal<FichaTecnica | null>(null);
  versoes = signal<FichaTecnica[]>([]);
  variacoes = signal<VariacaoGrade[]>([]);
  linhas = signal<LinhaFicha[]>([]);
  consumo = signal<FichaConsumo[]>([]);
  custo = signal<FichaCusto | null>(null);
  candidatos = signal<Produto[]>([]);
  carregando = signal(true);
  salvando = signal(false);
  erro = signal('');
  observacao = '';
  maoDeObra = 0;
  custosIndiretos = 0;
  buscaMaterial = '';
  variacaoConsulta: number | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  temVariacoes = computed(() => this.variacoes().length > 0);

  ngOnInit() {
    this.produtoId = Number(this.route.snapshot.paramMap.get('produtoId'));
    this.carregar();
  }

  moeda(valor: number | null) {
    return valor === null ? '—' : MOEDA.format(valor);
  }

  private falha(err: unknown, padrao: string) {
    this.erro.set(textoDoErro(lerErroApi(err, padrao), padrao));
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.produtos.getById(this.produtoId).subscribe({
      next: p => {
        this.produto.set(p);
        if (p.usaGrade) this.grade.obter(this.produtoId).subscribe(g => this.variacoes.set(g.variacoes));
        this.carregarFicha();
      },
      error: err => { this.falha(err, 'Produto não encontrado.'); this.carregando.set(false); }
    });
  }

  private carregarFicha() {
    this.service.versoes(this.produtoId).subscribe({
      next: vs => {
        this.versoes.set(vs);
        const atual = vs.find(v => v.vigente) ?? null;
        if (!atual) { this.vigente.set(null); this.linhas.set([]); this.carregando.set(false); return; }
        this.service.obter(atual.id).subscribe({
          next: f => { this.vigente.set(f); this.maoDeObra = f.maoDeObra; this.custosIndiretos = f.custosIndiretos; this.linhas.set(this.paraLinhas(f)); this.carregarConsumo(); this.carregando.set(false); },
          error: err => { this.falha(err, 'Não foi possível carregar a ficha.'); this.carregando.set(false); }
        });
      },
      error: err => { this.falha(err, 'Não foi possível carregar a ficha.'); this.carregando.set(false); }
    });
  }

  private paraLinhas(f: FichaTecnica): LinhaFicha[] {
    return f.itens.map(i => ({
      materialId: i.materialId, rotulo: `${i.materialSku} — ${i.materialNome}`, unidade: i.unidadeCodigo,
      variacaoId: i.variacaoId, quantidade: i.quantidade, perdaPercentual: i.perdaPercentual
    }));
  }

  carregarConsumo() {
    const f = this.vigente();
    if (!f) return;
    this.service.consumo(f.id, this.variacaoConsulta).subscribe(c => this.consumo.set(c));
    this.service.custo(f.id, this.variacaoConsulta).subscribe({ next: c => this.custo.set(c), error: () => this.custo.set(null) });
  }

  carregarVersao(id: number) {
    this.service.obter(id).subscribe(f => { this.linhas.set(this.paraLinhas(f)); this.maoDeObra = f.maoDeObra; this.custosIndiretos = f.custosIndiretos; this.observacao = `Base: v${f.versao}`; });
  }

  buscarMaterial() {
    clearTimeout(this.timer);
    const termo = this.buscaMaterial.trim();
    if (termo.length < 2) { this.candidatos.set([]); return; }
    this.timer = setTimeout(() => {
      this.produtos.buscar(termo, 30).subscribe(r =>
        this.candidatos.set(r.items.filter(p => p.id !== this.produtoId && !p.usaGrade && TIPOS_MATERIAL.includes(p.tipoItem as TipoItem))));
    }, 300);
  }

  adicionar(m: Produto) {
    this.linhas.update(ls => [...ls, {
      materialId: m.id, rotulo: `${m.sku} — ${m.nome}`, unidade: m.unidadeCodigo ?? 'un',
      variacaoId: null, quantidade: 1, perdaPercentual: 0
    }]);
    this.candidatos.set([]);
    this.buscaMaterial = '';
  }

  remover(indice: number) {
    this.linhas.update(ls => ls.filter((_, i) => i !== indice));
  }

  salvar() {
    this.salvando.set(true);
    this.erro.set('');
    this.service.salvar({
      produtoId: this.produtoId,
      observacao: this.observacao.trim() || null,
      maoDeObra: Number(this.maoDeObra) || 0,
      custosIndiretos: Number(this.custosIndiretos) || 0,
      itens: this.linhas().map(l => ({
        materialId: l.materialId, variacaoId: l.variacaoId, quantidade: Number(l.quantidade), perdaPercentual: Number(l.perdaPercentual) || 0
      }))
    }).subscribe({
      next: f => {
        this.salvando.set(false);
        this.observacao = '';
        this.toast.sucesso(`Ficha salva: versão ${f.versao}.`);
        this.carregarFicha();
      },
      error: err => { this.salvando.set(false); this.falha(err, 'Não foi possível salvar a ficha.'); }
    });
  }
}
