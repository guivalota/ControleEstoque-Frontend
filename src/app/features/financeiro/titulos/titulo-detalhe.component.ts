import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceiroTitulosService } from '../../../core/services/financeiro-titulos.service';
import { FinanceiroCadastrosService } from '../../../core/services/financeiro-cadastros.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { PodeDirective } from '../../../shared/permissao/pode.directive';
import { ContaFin } from '../../../core/models/financeiro-cadastros.model';
import {
  Baixa, FORMAS_PAGAMENTO, FormaPagamento, ROTULO_APROVACAO, ROTULO_EVENTO, ROTULO_FORMA, ROTULO_STATUS_TITULO, ROTULO_TIPO_TITULO,
  TituloDetalhe, TituloEvento, podeBaixar
} from '../../../core/models/financeiro-titulos.model';
import { hojeIso } from '../../../core/utils/financeiro-datas';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

type Painel = 'baixa' | 'cancelar' | null;

/**
 * Detalhe do título (US-24-03 / 04 / 08): dados, aprovação, baixas (registrar e estornar) e histórico. Baixa em título a pagar com
 * pedido de aprovação pendente fica bloqueada; o estorno só aparece para quem tem a permissão sensível.
 */
@Component({
  selector: 'app-titulo-detalhe',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PodeDirective],
  template: `
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }
    @if (titulo(); as t) {
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 class="h4 mb-1">{{ t.descricao }}</h1>
          <span class="text-secondary">{{ rotuloTipo(t) }} · {{ t.pessoaNome }}</span>
          <span class="badge ms-2" [class]="t.vencido ? 'text-bg-danger' : 'text-bg-primary'">{{ t.vencido ? 'Vencido' : rotuloStatus(t) }}</span>
          @if (t.aprovacaoStatus) { <span class="badge ms-1" [class]="t.aprovacaoStatus === 'aprovada' ? 'text-bg-success' : t.aprovacaoStatus === 'pendente' ? 'text-bg-warning' : 'text-bg-secondary'">{{ rotuloAprovacao(t) }}</span> }
        </div>
        <div class="d-flex flex-wrap gap-2">
          @if (t.status !== 'cancelado') {
            <a *appPode="'financeiro.titulos.editar'" class="btn btn-outline-primary btn-sm" [routerLink]="['/financeiro/titulos', t.id, 'editar']">Editar</a>
          }
          @if (baixavel()) {
            <button *appPode="'financeiro.baixas.registrar'" type="button" class="btn btn-primary btn-sm" (click)="abrir('baixa')">
              {{ t.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento' }}
            </button>
          }
          @if (t.status === 'aberto') {
            <button *appPode="'financeiro.titulos.cancelar'" type="button" class="btn btn-outline-danger btn-sm" (click)="abrir('cancelar')">Cancelar título</button>
          }
          <a class="btn btn-outline-primary btn-sm" routerLink="/financeiro/titulos">Voltar</a>
        </div>
      </div>

      @if (t.aprovacaoStatus === 'pendente') {
        <div class="alert alert-warning" role="status">
          Este pagamento aguarda a aprovação de outro administrador.
          <a *appPode="'core.aprovacoes.ver'" routerLink="/aprovacoes" [queryParams]="{ status: 'pendente' }" class="alert-link">Abrir a caixa de aprovações</a>
        </div>
      }
      @if (t.status === 'cancelado' && t.canceladoMotivo) {
        <div class="alert alert-secondary" role="status">Cancelado: {{ t.canceladoMotivo }}</div>
      }

      <dl class="row mb-4">
        <dt class="col-6 col-md-2">Valor</dt><dd class="col-6 col-md-2">{{ moeda(t.valor) }}</dd>
        <dt class="col-6 col-md-2">Saldo</dt><dd class="col-6 col-md-2">{{ moeda(t.saldo) }}</dd>
        <dt class="col-6 col-md-2">Vencimento</dt><dd class="col-6 col-md-2">{{ data(t.vencimento) }}</dd>
        <dt class="col-6 col-md-2">Emissão</dt><dd class="col-6 col-md-2">{{ data(t.emissao) }}</dd>
        <dt class="col-6 col-md-2">Competência</dt><dd class="col-6 col-md-2">{{ t.competencia.slice(5, 7) }}/{{ t.competencia.slice(0, 4) }}</dd>
        <dt class="col-6 col-md-2">Documento</dt><dd class="col-6 col-md-2">{{ t.documento || '—' }}</dd>
        <dt class="col-6 col-md-2">Categoria</dt><dd class="col-6 col-md-2">{{ t.categoriaNome }}</dd>
        <dt class="col-6 col-md-2">Centro de custo</dt><dd class="col-6 col-md-2">{{ t.centroCustoNome || '—' }}</dd>
        @if (t.origem) { <dt class="col-6 col-md-2">Origem</dt><dd class="col-6 col-md-2">{{ t.origem }} #{{ t.origemId }}</dd> }
        @if (t.totalParcelas) {
          <dt class="col-6 col-md-2">Parcela</dt>
          <dd class="col-6 col-md-2">{{ t.parcela }}/{{ t.totalParcelas }} · <a [routerLink]="['/financeiro/titulos']" [queryParams]="{ grupoId: t.grupoId }">ver todas</a></dd>
        }
        @if (t.recorrenciaId) { <dt class="col-6 col-md-2">Conta fixa</dt><dd class="col-6 col-md-2"><a routerLink="/financeiro/contas-fixas">#{{ t.recorrenciaId }}</a></dd> }
      </dl>

      <!-- ====================================================== registrar baixa -->
      @if (painel() === 'baixa') {
        <form class="card card-body mb-4" [formGroup]="formBaixa" (submit)="$event.preventDefault(); registrarBaixa()">
          <h2 class="h6">{{ t.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento' }}</h2>
          <div class="row g-2">
            <div class="col-6 col-md-3">
              <label class="form-label" for="bConta">Conta</label>
              <select id="bConta" class="form-select" formControlName="contaId" [class.is-invalid]="invalidoBaixa('contaId')">
                <option [ngValue]="null" disabled>Escolha…</option>
                @for (c of contas(); track c.id) { <option [ngValue]="c.id">{{ c.nome }}</option> }
              </select>
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label" for="bForma">Forma</label>
              <select id="bForma" class="form-select" formControlName="forma">
                @for (f of formas; track f) { <option [value]="f">{{ rotuloForma(f) }}</option> }
              </select>
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label" for="bData">Data</label>
              <input id="bData" type="date" class="form-control" formControlName="data" [max]="hoje">
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label" for="bValor">Valor (R$)</label>
              <input id="bValor" type="number" step="0.01" min="0.01" class="form-control" formControlName="valor" [class.is-invalid]="invalidoBaixa('valor')">
            </div>
            <div class="col-4 col-md-3">
              <label class="form-label" for="bJuros">Juros (R$)</label>
              <input id="bJuros" type="number" step="0.01" min="0" class="form-control" formControlName="juros">
            </div>
            <div class="col-4 col-md-3">
              <label class="form-label" for="bMulta">Multa (R$)</label>
              <input id="bMulta" type="number" step="0.01" min="0" class="form-control" formControlName="multa">
            </div>
            <div class="col-4 col-md-3">
              <label class="form-label" for="bDesc">Desconto (R$)</label>
              <input id="bDesc" type="number" step="0.01" min="0" class="form-control" formControlName="desconto">
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="bObs">Observação</label>
              <input id="bObs" class="form-control" formControlName="observacao" maxlength="500">
            </div>
          </div>
          <p class="small text-secondary mt-2 mb-0">
            Abate do saldo: {{ moeda(abatimento()) }} (valor + desconto, no máximo {{ moeda(t.saldo) }}).
            Movimenta a conta: {{ moeda(movimento()) }} (valor + juros + multa).
          </p>
          @if (abatimento() > t.saldo) { <div class="text-danger small" role="alert">O valor mais o desconto excede o saldo do título.</div> }
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando() || abatimento() > t.saldo">Confirmar</button>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="fechar()">Cancelar</button>
          </div>
        </form>
      }

      <!-- ============================================================ cancelar -->
      @if (painel() === 'cancelar') {
        <form class="card card-body mb-4" [formGroup]="formCancelar" (submit)="$event.preventDefault(); cancelar()">
          <h2 class="h6">Cancelar título</h2>
          <label class="form-label" for="cMotivo">Motivo</label>
          <input id="cMotivo" class="form-control" formControlName="motivo" maxlength="500" [class.is-invalid]="formCancelar.controls.motivo.invalid && formCancelar.controls.motivo.touched">
          <div class="mt-3 d-flex gap-2">
            <button type="submit" class="btn btn-danger btn-sm" [disabled]="salvando()">Cancelar título</button>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="fechar()">Voltar</button>
          </div>
        </form>
      }

      <h2 class="h6">Baixas</h2>
      <div class="table-responsive mb-4">
        <table class="table table-sm align-middle">
          <thead><tr><th>Data</th><th>Conta</th><th>Forma</th><th class="text-end">Valor</th><th class="text-end">Juros</th><th class="text-end">Multa</th><th class="text-end">Desconto</th><th class="text-end">Movimentou</th><th></th></tr></thead>
          <tbody>
            @for (b of t.baixas; track b.id) {
              <tr [class.text-decoration-line-through]="b.estornada" [class.text-secondary]="b.estornada">
                <td>{{ data(b.data) }}</td><td>{{ b.contaNome }}</td><td>{{ rotuloForma(b.forma) }}</td>
                <td class="text-end">{{ moeda(b.valor) }}</td><td class="text-end">{{ moeda(b.juros) }}</td><td class="text-end">{{ moeda(b.multa) }}</td>
                <td class="text-end">{{ moeda(b.desconto) }}</td><td class="text-end">{{ moeda(b.totalPago) }}</td>
                <td class="text-end text-nowrap">
                  @if (b.estornada) {
                    <span class="badge text-bg-secondary" [title]="b.estornoMotivo ?? ''">Estornada</span>
                  } @else {
                    <button *appPode="'financeiro.baixas.estornar'" type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Estornar baixa de ' + data(b.data)" (click)="iniciarEstorno(b)">Estornar</button>
                  }
                </td>
              </tr>
              @if (estornando()?.id === b.id) {
                <tr>
                  <td colspan="9">
                    <form class="d-flex flex-wrap gap-2 align-items-end" [formGroup]="formEstorno" (submit)="$event.preventDefault(); estornar(b)">
                      <div class="flex-grow-1">
                        <label class="form-label small mb-1" for="eMotivo">Motivo do estorno</label>
                        <input id="eMotivo" class="form-control form-control-sm" formControlName="motivo" maxlength="500">
                      </div>
                      <button type="submit" class="btn btn-danger btn-sm" [disabled]="salvando()">Confirmar estorno</button>
                      <button type="button" class="btn btn-outline-primary btn-sm" (click)="estornando.set(null)">Voltar</button>
                    </form>
                  </td>
                </tr>
              }
            } @empty { <tr><td colspan="9" class="text-secondary">Nenhuma baixa registrada.</td></tr> }
          </tbody>
        </table>
      </div>

      <h2 class="h6">Histórico</h2>
      <ul class="list-unstyled small">
        @for (e of t.eventos; track e.id) {
          <li class="mb-1"><strong>{{ rotuloEvento(e) }}</strong> · {{ dataHora(e.criadoEm) }}{{ e.usuarioNome ? ' · ' + e.usuarioNome : '' }}
            @if (resumo(e); as r) { <span class="text-secondary"> — {{ r }}</span> }
          </li>
        }
      </ul>
    } @else if (!erro()) {
      <p class="text-secondary">Carregando…</p>
    }
  `
})
export class TituloDetalheComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(FinanceiroTitulosService);
  private cadastros = inject(FinanceiroCadastrosService);
  private toast = inject(ToastService);
  private rota = inject(ActivatedRoute);
  permissao = inject(PermissaoService);

  readonly formas = FORMAS_PAGAMENTO;
  readonly hoje = hojeIso();

  titulo = signal<TituloDetalhe | null>(null);
  contas = signal<ContaFin[]>([]);
  painel = signal<Painel>(null);
  estornando = signal<Baixa | null>(null);
  salvando = signal(false);
  erro = signal('');

  baixavel = computed(() => { const t = this.titulo(); return !!t && podeBaixar(t); });

  formBaixa = this.fb.nonNullable.group({
    contaId: [null as number | null, Validators.required],
    forma: ['pix' as FormaPagamento],
    data: [hojeIso()],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    juros: [0], multa: [0], desconto: [0],
    observacao: ['']
  });
  formCancelar = this.fb.nonNullable.group({ motivo: ['', Validators.required] });
  formEstorno = this.fb.nonNullable.group({ motivo: ['', Validators.required] });

  private get idDaRota() { return Number(this.rota.snapshot.paramMap.get('id')); }

  ngOnInit() { this.carregar(); }

  private carregar() {
    this.service.obter(this.idDaRota).subscribe({
      next: t => this.titulo.set(t),
      error: e => this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar o título.'), 'Não foi possível carregar o título.'))
    });
  }

  abrir(p: Exclude<Painel, null>) {
    this.erro.set('');
    this.painel.set(p);
    if (p === 'baixa') {
      this.cadastros.contas().subscribe({ next: l => this.contas.set(l.filter(c => c.ativo)), error: () => undefined });
      this.formBaixa.reset({ contaId: null, forma: 'pix', data: hojeIso(), valor: this.titulo()?.saldo ?? null, juros: 0, multa: 0, desconto: 0, observacao: '' });
    } else {
      this.formCancelar.reset({ motivo: '' });
    }
  }

  fechar() { this.painel.set(null); }

  invalidoBaixa(campo: string) { const c = this.formBaixa.get(campo); return !!c && c.invalid && c.touched; }
  abatimento() { const v = this.formBaixa.getRawValue(); return Math.round((Number(v.valor || 0) + Number(v.desconto || 0)) * 100) / 100; }
  movimento() { const v = this.formBaixa.getRawValue(); return Math.round((Number(v.valor || 0) + Number(v.juros || 0) + Number(v.multa || 0)) * 100) / 100; }

  private depois(mensagem: string) {
    return {
      next: (t: TituloDetalhe) => { this.salvando.set(false); this.titulo.set(t); this.painel.set(null); this.estornando.set(null); this.toast.sucesso(mensagem); },
      error: (e: unknown) => { this.salvando.set(false); this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível concluir a operação.'), 'Não foi possível concluir a operação.')); }
    };
  }

  registrarBaixa() {
    const t = this.titulo();
    if (!t) return;
    if (this.formBaixa.invalid) { this.formBaixa.markAllAsTouched(); return; }
    const v = this.formBaixa.getRawValue();
    this.salvando.set(true);
    this.service.baixar(t.id, {
      contaId: v.contaId!, forma: v.forma, data: v.data || null, valor: Number(v.valor), juros: Number(v.juros || 0),
      multa: Number(v.multa || 0), desconto: Number(v.desconto || 0), observacao: v.observacao?.trim() || null
    }).subscribe(this.depois('Baixa registrada.'));
  }

  cancelar() {
    const t = this.titulo();
    if (!t) return;
    if (this.formCancelar.invalid) { this.formCancelar.markAllAsTouched(); return; }
    this.salvando.set(true);
    this.service.cancelar(t.id, this.formCancelar.getRawValue().motivo.trim()).subscribe(this.depois('Título cancelado.'));
  }

  iniciarEstorno(b: Baixa) { this.formEstorno.reset({ motivo: '' }); this.estornando.set(b); }

  estornar(b: Baixa) {
    if (this.formEstorno.invalid) { this.formEstorno.markAllAsTouched(); return; }
    this.salvando.set(true);
    this.service.estornar(b.id, this.formEstorno.getRawValue().motivo.trim()).subscribe(this.depois('Baixa estornada.'));
  }

  moeda(v: number) { return formatarMoeda(v); }
  data(iso: string) { return formatarData(iso); }
  dataHora(iso: string) { return formatarDataHora(iso); }
  rotuloTipo(t: TituloDetalhe) { return ROTULO_TIPO_TITULO[t.tipo]; }
  rotuloStatus(t: TituloDetalhe) { return ROTULO_STATUS_TITULO[t.status]; }
  rotuloAprovacao(t: TituloDetalhe) { return t.aprovacaoStatus ? ROTULO_APROVACAO[t.aprovacaoStatus] : ''; }
  rotuloForma(f: FormaPagamento) { return ROTULO_FORMA[f] ?? f; }
  rotuloEvento(e: TituloEvento) { return ROTULO_EVENTO[e.tipo] ?? e.tipo; }

  /** Resumo curto do detalhe do evento (valor, motivo, o que mudou). */
  resumo(e: TituloEvento): string {
    if (!e.detalhe) return '';
    try {
      const d = JSON.parse(e.detalhe) as Record<string, unknown>;
      if (typeof d['motivo'] === 'string' && d['motivo']) return String(d['motivo']);
      if (e.tipo === 'alteracao') return Object.keys(d).join(', ');
      if (e.tipo === 'baixa' || e.tipo === 'estorno') return `saldo ${formatarMoeda(Number(d['saldo']))}`;
      return '';
    } catch { return ''; }
  }
}
