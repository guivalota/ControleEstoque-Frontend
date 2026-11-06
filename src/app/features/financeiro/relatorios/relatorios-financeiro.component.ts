import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceiroRelatoriosService } from '../../../core/services/financeiro-relatorios.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { ClienteService } from '../../../core/services/cliente.service';
import { ToastService } from '../../../core/services/toast.service';
import { PodeDirective } from '../../../shared/permissao/pode.directive';
import { CategoriaFin } from '../../../core/models/financeiro-cadastros.model';
import { FiltroRelatorioFin, NomeRelatorioFin, ROTULO_RELATORIO_FIN, RelatorioTabela } from '../../../core/models/financeiro-relatorios.model';
import { hojeIso, mesAtual, ultimoDiaDoMes } from '../../../core/utils/financeiro-datas';
import { baixarBlob } from '../../../core/utils/download';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/**
 * Relatórios do Financeiro (US-24-05): vencimentos, aging, títulos por categoria e extrato por pessoa. A tela mostra a tabela que
 * o servidor monta (a mesma do CSV e do PDF); exportar exige `financeiro.relatorios.exportar`.
 */
@Component({
  selector: 'app-relatorios-financeiro',
  standalone: true,
  imports: [FormsModule, PodeDirective],
  template: `
    <h1 class="h4 mb-3">Relatórios do financeiro</h1>
    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (n of nomes; track n) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="nome() === n" [attr.aria-selected]="nome() === n" (click)="trocar(n)">{{ rotulo(n) }}</button>
        </li>
      }
    </ul>

    <form class="row g-2 align-items-end mb-3" (submit)="$event.preventDefault(); gerar()">
      @if (nome() === 'aging') {
        <div class="col-6 col-md-2">
          <label class="form-label small mb-1" for="rTipo">Tipo</label>
          <select id="rTipo" class="form-select form-select-sm" name="tipo" [(ngModel)]="tipo"><option value="pagar">A pagar</option><option value="receber">A receber</option></select>
        </div>
        <div class="col-6 col-md-2"><label class="form-label small mb-1" for="rPos">Posição em</label><input id="rPos" type="date" class="form-control form-control-sm" name="pos" [(ngModel)]="posicao"></div>
      } @else {
        <div class="col-6 col-md-2"><label class="form-label small mb-1" for="rDe">De</label><input id="rDe" type="date" class="form-control form-control-sm" name="de" [(ngModel)]="de"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-1" for="rAte">Até</label><input id="rAte" type="date" class="form-control form-control-sm" name="ate" [(ngModel)]="ate"></div>
      }
      @if (nome() === 'vencimentos') {
        <div class="col-6 col-md-2">
          <label class="form-label small mb-1" for="rTipoV">Tipo</label>
          <select id="rTipoV" class="form-select form-select-sm" name="tipoV" [(ngModel)]="tipo"><option value="">Todos</option><option value="pagar">A pagar</option><option value="receber">A receber</option></select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="rCat">Categoria</label>
          <select id="rCat" class="form-select form-select-sm" name="cat" [(ngModel)]="categoriaId">
            <option [ngValue]="null">Todas</option>
            @for (c of categorias(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
          </select>
        </div>
      }
      @if (nome() === 'extrato-pessoa') {
        <div class="col-6 col-md-2">
          <label class="form-label small mb-1" for="rQuem">Pessoa</label>
          <select id="rQuem" class="form-select form-select-sm" name="quem" [(ngModel)]="quem"><option value="fornecedor">Fornecedor</option><option value="cliente">Cliente</option></select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="rPessoa">{{ quem === 'fornecedor' ? 'Fornecedor' : 'Cliente' }}</label>
          <select id="rPessoa" class="form-select form-select-sm" name="pessoa" [(ngModel)]="pessoaId">
            <option [ngValue]="null" disabled>Escolha…</option>
            @for (p of pessoas(); track p.id) { <option [ngValue]="p.id">{{ p.nome }}</option> }
          </select>
        </div>
      }
      <div class="col-12 d-flex gap-2">
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="carregando()">Gerar</button>
        <ng-container *appPode="'financeiro.relatorios.exportar'">
          <button type="button" class="btn btn-outline-primary btn-sm" [disabled]="!tabela()" (click)="exportar('csv')">CSV</button>
          <button type="button" class="btn btn-outline-primary btn-sm" [disabled]="!tabela()" (click)="exportar('pdf')">PDF</button>
        </ng-container>
      </div>
    </form>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (tabela(); as t) {
      <h2 class="h6 mb-0">{{ t.titulo }}</h2>
      @for (c of t.contexto; track c) { <p class="small text-secondary mb-2">{{ c }}</p> }
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead><tr>@for (c of t.colunas; track c.titulo) { <th [class.text-end]="c.numerica">{{ c.titulo }}</th> }</tr></thead>
          <tbody>
            @for (l of t.linhas; track $index) {
              <tr>@for (v of l; track $index) { <td [class.text-end]="t.colunas[$index].numerica">{{ celula(v, t.colunas[$index].titulo) }}</td> }</tr>
            } @empty { <tr><td [attr.colspan]="t.colunas.length" class="text-secondary">Nada encontrado neste período.</td></tr> }
          </tbody>
          @if (t.totais) {
            <tfoot><tr class="fw-semibold">@for (v of t.totais; track $index) { <td [class.text-end]="t.colunas[$index].numerica">{{ celula(v, t.colunas[$index].titulo) }}</td> }</tr></tfoot>
          }
        </table>
      </div>
    }
  `
})
export class RelatoriosFinanceiroComponent implements OnInit {
  private service = inject(FinanceiroRelatoriosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private fornecedores = inject(FornecedorService);
  private clientes = inject(ClienteService);
  private toast = inject(ToastService);

  readonly nomes: NomeRelatorioFin[] = ['vencimentos', 'aging', 'por-categoria', 'extrato-pessoa'];

  nome = signal<NomeRelatorioFin>('vencimentos');
  tabela = signal<RelatorioTabela | null>(null);
  carregando = signal(false);
  erro = signal('');
  categorias = signal<CategoriaFin[]>([]);

  de = hojeIso();
  ate = ultimoDiaDoMes(mesAtual());
  tipo: 'pagar' | 'receber' | '' = '';
  posicao = hojeIso();
  categoriaId: number | null = null;
  quem: 'fornecedor' | 'cliente' = 'fornecedor';
  pessoaId: number | null = null;

  pessoas = () => this.quem === 'fornecedor'
    ? this.fornecedores.fornecedores().map(f => ({ id: f.id, nome: f.razaoSocial }))
    : this.clientes.clientes().map(c => ({ id: c.id, nome: c.nome }));

  ngOnInit() {
    this.cadastros.categorias().subscribe({ next: l => this.categorias.set(l), error: () => undefined });
    this.fornecedores.getAll().subscribe({ error: () => undefined });
    this.clientes.getAll().subscribe({ error: () => undefined });
    this.gerar();
  }

  rotulo(n: NomeRelatorioFin) { return ROTULO_RELATORIO_FIN[n]; }

  trocar(n: NomeRelatorioFin) {
    this.nome.set(n);
    this.tipo = n === 'aging' ? 'pagar' : '';
    this.tabela.set(null);
    this.erro.set('');
    if (n !== 'extrato-pessoa') this.gerar();
  }

  private filtro(): FiltroRelatorioFin {
    const n = this.nome();
    if (n === 'aging') return { tipo: this.tipo, posicao: this.posicao };
    const base: FiltroRelatorioFin = { de: this.de, ate: this.ate };
    if (n === 'vencimentos') return { ...base, tipo: this.tipo, categoriaId: this.categoriaId };
    if (n === 'extrato-pessoa') return { ...base, fornecedorId: this.quem === 'fornecedor' ? this.pessoaId : null, clienteId: this.quem === 'cliente' ? this.pessoaId : null };
    return base;
  }

  gerar() {
    if (this.nome() === 'extrato-pessoa' && !this.pessoaId) { this.erro.set('Escolha o fornecedor ou o cliente.'); return; }
    this.carregando.set(true);
    this.erro.set('');
    this.service.relatorio(this.nome(), this.filtro()).subscribe({
      next: t => { this.tabela.set(t); this.carregando.set(false); },
      error: e => { this.carregando.set(false); this.tabela.set(null); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível gerar o relatório.'), 'Não foi possível gerar o relatório.')); }
    });
  }

  exportar(formato: 'csv' | 'pdf') {
    this.service.exportar(this.nome(), formato, this.filtro()).subscribe({
      next: blob => baixarBlob(blob, `${this.nome()}.${formato}`),
      error: e => this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível exportar.'), 'Não foi possível exportar.'))
    });
  }

  /** Células vêm tipadas do servidor: datas `aaaa-mm-dd` viram dd/MM/aaaa; números monetários, em reais (contagens ficam inteiras). */
  celula(v: string | number | null, coluna: string): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return /títulos|dias de atraso/i.test(coluna) ? String(v) : formatarMoeda(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatarData(v) : v;
  }
}
