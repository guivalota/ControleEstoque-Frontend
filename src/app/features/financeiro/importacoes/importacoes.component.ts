import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceiroRelatoriosService } from '../../../core/services/financeiro-relatorios.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoriaFin } from '../../../core/models/financeiro-cadastros.model';
import { Importacao, ROTULO_SITUACAO_IMPORTACAO } from '../../../core/models/financeiro-relatorios.model';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/**
 * Lançamentos vindos do Estoque (NF de entrada) e da Produção (retorno da terceirização) que esperam o administrador (US-24-06).
 * Quem chegou com o módulo já ligado entra sozinho; o que ficou esperando a primeira ativação é confirmado aqui (com vencimento e
 * categoria opcionais) ou descartado.
 */
@Component({
  selector: 'app-importacoes',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1 class="h4 mb-2">Importações pendentes</h1>
    <p class="text-secondary small">Notas de entrada do Estoque e retornos da terceirização que viram contas a pagar. Se não informar o vencimento, vale a data de emissão mais o prazo padrão da empresa.</p>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead><tr><th>Origem</th><th>Descrição</th><th>Pessoa</th><th>Data</th><th class="text-end">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (i of itens(); track i.id) {
            <tr>
              <td>{{ i.tipoNome }}</td><td>{{ i.descricao }}</td><td>{{ i.pessoa || '—' }}</td><td>{{ data(i.data) }}</td>
              <td class="text-end">{{ moeda(i.valor) }}</td>
              <td>
                <span class="badge" [class]="classe(i)">{{ rotuloSituacao(i) }}</span>
                @if (i.ultimoErro) { <div class="small text-danger">{{ i.ultimoErro }}</div> }
              </td>
              <td class="text-end text-nowrap">
                <button type="button" class="btn btn-sm btn-primary me-1" [attr.aria-label]="'Importar ' + i.descricao" (click)="abrirAjustes(i)">Importar</button>
                <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Descartar ' + i.descricao" (click)="descartar(i)">Descartar</button>
              </td>
            </tr>
            @if (ajustando()?.id === i.id) {
              <tr>
                <td colspan="7">
                  <form class="row g-2 align-items-end" (submit)="$event.preventDefault(); confirmar(i)">
                    <div class="col-12 col-md-3"><label class="form-label small mb-1" for="aVenc">Vencimento (opcional)</label><input id="aVenc" type="date" class="form-control form-control-sm" name="venc" [(ngModel)]="vencimento"></div>
                    <div class="col-12 col-md-4">
                      <label class="form-label small mb-1" for="aCat">Categoria (opcional)</label>
                      <select id="aCat" class="form-select form-select-sm" name="cat" [(ngModel)]="categoriaId">
                        <option [ngValue]="null">Padrão da empresa</option>
                        @for (c of categorias(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
                      </select>
                    </div>
                    <div class="col-12 col-md-5 d-flex gap-2">
                      <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">Confirmar importação</button>
                      <button type="button" class="btn btn-outline-primary btn-sm" (click)="ajustando.set(null)">Voltar</button>
                    </div>
                  </form>
                </td>
              </tr>
            }
          } @empty {
            <tr><td colspan="7" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhum lançamento pendente.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class ImportacoesComponent implements OnInit {
  private service = inject(FinanceiroRelatoriosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private toast = inject(ToastService);

  itens = signal<Importacao[]>([]);
  categorias = signal<CategoriaFin[]>([]);
  ajustando = signal<Importacao | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  erro = signal('');
  vencimento = '';
  categoriaId: number | null = null;

  ngOnInit() {
    this.cadastros.categorias().subscribe({ next: l => this.categorias.set(l.filter(c => c.natureza === 'despesa' && c.ativo)), error: () => undefined });
    this.carregar();
  }

  private carregar() {
    this.carregando.set(true);
    this.service.importacoes().subscribe({
      next: l => { this.itens.set(l); this.carregando.set(false); },
      error: e => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar as importações.'), 'Não foi possível carregar as importações.')); }
    });
  }

  abrirAjustes(i: Importacao) { this.vencimento = ''; this.categoriaId = null; this.ajustando.set(i); }

  confirmar(i: Importacao) {
    this.salvando.set(true);
    this.service.confirmarImportacao(i.id, { vencimento: this.vencimento || null, categoriaId: this.categoriaId }).subscribe({
      next: () => { this.salvando.set(false); this.ajustando.set(null); this.toast.sucesso('Título gerado.'); this.carregar(); },
      error: e => { this.salvando.set(false); this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível importar.'), 'Não foi possível importar.')); }
    });
  }

  descartar(i: Importacao) {
    if (!confirm(`Descartar "${i.descricao}"? Nenhum título será gerado.`)) return;
    this.service.descartarImportacao(i.id).subscribe({
      next: () => { this.toast.sucesso('Lançamento descartado.'); this.carregar(); },
      error: e => this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível descartar.'), 'Não foi possível descartar.'))
    });
  }

  moeda(v: number | null) { return formatarMoeda(v); }
  data(iso: string | null) { return formatarData(iso); }
  rotuloSituacao(i: Importacao) { return ROTULO_SITUACAO_IMPORTACAO[i.situacao]; }
  classe(i: Importacao) { return { aguardando: 'text-bg-warning', automatico: 'text-bg-info', erro: 'text-bg-danger' }[i.situacao]; }
}
