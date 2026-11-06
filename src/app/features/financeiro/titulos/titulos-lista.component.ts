import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FinanceiroTitulosService } from '../../../core/services/financeiro-titulos.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { PodeDirective } from '../../../shared/permissao/pode.directive';
import {
  FiltroStatusTitulo, ROTULO_APROVACAO, ROTULO_STATUS_TITULO, ROTULO_TIPO_TITULO, TipoTitulo, Titulo
} from '../../../core/models/financeiro-titulos.model';
import { CategoriaFin, CentroCustoFin } from '../../../core/models/financeiro-cadastros.model';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

const TAMANHO_PAGINA = 20;

/**
 * Títulos a pagar e a receber (US-24-03). Filtros ficam na URL (a lista pode ser compartilhada e os atalhos do painel
 * levam direto a "vencidos" ou "a vencer"). Vencido é calculado pelo servidor com a data de São Paulo.
 */
@Component({
  selector: 'app-titulos-lista',
  standalone: true,
  imports: [FormsModule, RouterLink, PodeDirective],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Títulos</h1>
      <div class="d-flex gap-2">
        <a *appPode="'financeiro.titulos.criar'" class="btn btn-primary btn-sm" routerLink="/financeiro/titulos/novo">
          <i class="bi bi-plus-lg me-1"></i>Novo título
        </a>
        <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/contas-fixas"><i class="bi bi-arrow-repeat me-1"></i>Contas fixas</a>
      </div>
    </div>

    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (t of abas; track t.valor) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="tipo() === t.valor" [attr.aria-selected]="tipo() === t.valor"
                  (click)="trocarTipo(t.valor)">{{ t.rotulo }}</button>
        </li>
      }
    </ul>

    <form class="row g-2 align-items-end mb-3" (submit)="$event.preventDefault(); filtrar()">
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fStatus">Situação</label>
        <select id="fStatus" class="form-select form-select-sm" name="status" [(ngModel)]="status">
          <option value="">Todas</option>
          @for (s of situacoes; track s.valor) { <option [value]="s.valor">{{ s.rotulo }}</option> }
        </select>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fDe">Vence de</label>
        <input id="fDe" type="date" class="form-control form-control-sm" name="de" [(ngModel)]="vencimentoDe">
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fAte">até</label>
        <input id="fAte" type="date" class="form-control form-control-sm" name="ate" [(ngModel)]="vencimentoAte">
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fCat">Categoria</label>
        <select id="fCat" class="form-select form-select-sm" name="cat" [(ngModel)]="categoriaId">
          <option [ngValue]="null">Todas</option>
          @for (c of categorias(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
        </select>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fCen">Centro de custo</label>
        <select id="fCen" class="form-select form-select-sm" name="cen" [(ngModel)]="centroCustoId">
          <option [ngValue]="null">Todos</option>
          @for (c of centros(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
        </select>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1" for="fBusca">Busca</label>
        <input id="fBusca" class="form-control form-control-sm" name="busca" [(ngModel)]="busca" placeholder="descrição, nota ou pessoa">
      </div>
      <div class="col-12 d-flex gap-2">
        <button type="submit" class="btn btn-primary btn-sm">Filtrar</button>
        <button type="button" class="btn btn-outline-primary btn-sm" (click)="limpar()">Limpar</button>
      </div>
    </form>

    @if (grupoId || recorrenciaId) {
      <div class="alert alert-info d-flex justify-content-between align-items-center py-2" role="status">
        <span>{{ grupoId ? 'Mostrando só as parcelas do mesmo lançamento.' : 'Mostrando só os títulos desta conta fixa.' }}</span>
        <button type="button" class="btn btn-outline-primary btn-sm" (click)="limpar()">Ver todos</button>
      </div>
    }
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr><th>Vencimento</th><th>Pessoa</th><th>Descrição</th><th>Categoria</th><th class="text-end">Valor</th><th class="text-end">Saldo</th><th>Situação</th><th></th></tr>
        </thead>
        <tbody>
          @for (t of titulos(); track t.id) {
            <tr>
              <td [class.text-danger]="t.vencido" [class.fw-semibold]="t.vencido">{{ data(t.vencimento) }}</td>
              <td>{{ t.pessoaNome }}</td>
              <td>
                {{ t.descricao }}
                @if (t.origem) { <span class="badge text-bg-light border ms-1" title="Veio de outro módulo">{{ rotuloOrigem(t.origem) }}</span> }
              </td>
              <td>{{ t.categoriaNome }}</td>
              <td class="text-end">{{ moeda(t.valor) }}</td>
              <td class="text-end">{{ moeda(t.saldo) }}</td>
              <td>
                <span class="badge" [class]="classeStatus(t)">{{ rotuloStatus(t) }}</span>
                @if (t.aprovacaoStatus === 'pendente') { <span class="badge text-bg-warning ms-1">{{ rotuloAprovacao(t) }}</span> }
              </td>
              <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/financeiro/titulos', t.id]" [attr.aria-label]="'Abrir ' + t.descricao">Abrir</a></td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhum título encontrado.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > tamanho) {
      <nav class="d-flex justify-content-between align-items-center" aria-label="Paginação">
        <span class="small text-secondary">{{ total() }} título(s) · página {{ pagina() }} de {{ paginas() }}</span>
        <div class="btn-group">
          <button type="button" class="btn btn-outline-primary btn-sm" [disabled]="pagina() <= 1" (click)="irPara(pagina() - 1)">Anterior</button>
          <button type="button" class="btn btn-outline-primary btn-sm" [disabled]="pagina() >= paginas()" (click)="irPara(pagina() + 1)">Próxima</button>
        </div>
      </nav>
    }
  `
})
export class TitulosListaComponent implements OnInit {
  private service = inject(FinanceiroTitulosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private rota = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tamanho = TAMANHO_PAGINA;
  readonly abas: { valor: TipoTitulo | ''; rotulo: string }[] = [
    { valor: '', rotulo: 'Todos' }, { valor: 'pagar', rotulo: ROTULO_TIPO_TITULO.pagar }, { valor: 'receber', rotulo: ROTULO_TIPO_TITULO.receber }
  ];
  readonly situacoes: { valor: FiltroStatusTitulo; rotulo: string }[] = [
    { valor: 'vencido', rotulo: 'Vencidos' }, { valor: 'aberto', rotulo: ROTULO_STATUS_TITULO.aberto }, { valor: 'parcial', rotulo: ROTULO_STATUS_TITULO.parcial },
    { valor: 'quitado', rotulo: ROTULO_STATUS_TITULO.quitado }, { valor: 'cancelado', rotulo: ROTULO_STATUS_TITULO.cancelado }
  ];

  titulos = signal<Titulo[]>([]);
  total = signal(0);
  pagina = signal(1);
  carregando = signal(false);
  erro = signal('');
  categorias = signal<CategoriaFin[]>([]);
  centros = signal<CentroCustoFin[]>([]);
  paginas = computed(() => Math.max(1, Math.ceil(this.total() / TAMANHO_PAGINA)));

  tipo = signal<TipoTitulo | ''>('');
  status: FiltroStatusTitulo | '' = '';
  vencimentoDe = '';
  vencimentoAte = '';
  categoriaId: number | null = null;
  centroCustoId: number | null = null;
  busca = '';
  grupoId = '';
  recorrenciaId: number | null = null;

  ngOnInit() {
    const q = this.rota.snapshot.queryParamMap;
    this.tipo.set((q.get('tipo') as TipoTitulo | null) ?? '');
    this.status = (q.get('status') as FiltroStatusTitulo | null) ?? '';
    this.vencimentoDe = q.get('vencimentoDe') ?? '';
    this.vencimentoAte = q.get('vencimentoAte') ?? '';
    this.busca = q.get('busca') ?? '';
    this.grupoId = q.get('grupoId') ?? '';
    this.recorrenciaId = q.get('recorrenciaId') ? Number(q.get('recorrenciaId')) : null;
    this.categoriaId = q.get('categoriaId') ? Number(q.get('categoriaId')) : null;
    this.centroCustoId = q.get('centroCustoId') ? Number(q.get('centroCustoId')) : null;
    this.pagina.set(Number(q.get('page') ?? 1) || 1);
    this.cadastros.categorias().subscribe({ next: l => this.categorias.set(l), error: () => undefined });
    this.cadastros.centros().subscribe({ next: l => this.centros.set(l), error: () => undefined });
    this.carregar();
  }

  trocarTipo(tipo: TipoTitulo | '') { this.tipo.set(tipo); this.filtrar(); }
  filtrar() { this.pagina.set(1); this.carregar(); }
  irPara(p: number) { this.pagina.set(p); this.carregar(); }

  limpar() {
    this.status = ''; this.vencimentoDe = ''; this.vencimentoAte = ''; this.categoriaId = null; this.centroCustoId = null; this.busca = ''; this.grupoId = ''; this.recorrenciaId = null;
    this.filtrar();
  }

  private carregar() {
    const filtro = {
      tipo: this.tipo(), status: this.status, vencimentoDe: this.vencimentoDe, vencimentoAte: this.vencimentoAte,
      categoriaId: this.categoriaId, centroCustoId: this.centroCustoId, busca: this.busca.trim(),
      grupoId: this.grupoId, recorrenciaId: this.recorrenciaId,
      page: this.pagina(), pageSize: TAMANHO_PAGINA
    };
    // A URL guarda os filtros (menos a página 1 e o tamanho), então recarregar ou compartilhar mantém a lista.
    const queryParams: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(filtro)) if (v !== '' && v !== null && k !== 'pageSize' && !(k === 'page' && v === 1)) queryParams[k] = v as string | number;
    void this.router.navigate([], { relativeTo: this.rota, queryParams, replaceUrl: true });

    this.carregando.set(true);
    this.erro.set('');
    this.service.listar(filtro).subscribe({
      next: r => { this.titulos.set(r.items); this.total.set(r.total); this.carregando.set(false); },
      error: e => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar os títulos.'), 'Não foi possível carregar os títulos.')); }
    });
  }

  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }
  rotuloAprovacao(t: Titulo) { return t.aprovacaoStatus ? ROTULO_APROVACAO[t.aprovacaoStatus] : ''; }
  rotuloOrigem(origem: string) { return origem.startsWith('estoque') ? 'Estoque' : origem.startsWith('producao') ? 'Produção' : origem; }
  rotuloStatus(t: Titulo) { return t.vencido ? 'Vencido' : ROTULO_STATUS_TITULO[t.status]; }

  classeStatus(t: Titulo) {
    if (t.vencido) return 'text-bg-danger';
    return { aberto: 'text-bg-primary', parcial: 'text-bg-info', quitado: 'text-bg-success', cancelado: 'text-bg-secondary' }[t.status];
  }
}
