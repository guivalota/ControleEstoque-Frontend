import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EtiquetaAcabadoService, MODELOS_ETIQUETA_ACABADO } from '../../../core/services/etiqueta-acabado.service';
import { FichaTecnicaService } from '../../../core/services/ficha-tecnica.service';
import { CorteOrdemComponent } from './corte-ordem.component';
import { LotesOrdemComponent } from './lotes-ordem.component';
import { OrdemProducaoService } from '../../../core/services/ordem-producao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { Apontamento, FaltaMaterial, OrdemProducao, ROTULO_STATUS_ORDEM, Sobreproducao } from '../../../core/models/ordem-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { baixarBlob } from '../../../core/utils/download';
import { formatarData } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

interface AjusteConsumo {
  materialId: number;
  nome: string;
  unidade: string;
  porPeca: number;
  real: number | null;
  motivo: string;
}

interface LinhaApontar {
  variacaoId: number | null;
  rotulo: string;
  planejado: number;
  apontado: number;
  quantidade: number | null;
  ajustando: boolean;
  consumos: AjusteConsumo[];
}

/**
 * Ordem de produção: quantidade por tamanho, necessidade de material (com o que está reservado e o que falta),
 * ações de estado e histórico. Liberar com falta de material só acontece depois da confirmação explícita.
 */
@Component({
  selector: 'app-ordem-detalhe',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe, CorteOrdemComponent, LotesOrdemComponent],
  template: `
    <a routerLink="/producao/ordens" class="small">← Ordens de produção</a>
    @if (ordem(); as o) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-1 mb-1">
        <h1 class="h4 mb-0">Ordem {{ o.numero }}</h1>
        <span class="badge text-bg-secondary">{{ rotulo[o.status] }}</span>
      </div>
      <p class="text-secondary small">
        {{ o.produtoSku }} — {{ o.produtoNome }} · ficha v{{ o.fichaVersao }} · {{ o.quantidadeTotal | qtd }} peça(s)
        @if (o.prazo) { · prazo {{ data(o.prazo) }} }
        @if (o.observacao) { · {{ o.observacao }} }
      </p>

      @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

      @if (faltas().length > 0) {
        <div class="alert alert-warning" role="alert">
          <strong>Falta material para liberar:</strong>
          <ul class="mb-2">
            @for (f of faltas(); track f.materialId) {
              <li>{{ f.materialNome }}: precisa de {{ f.necessidade | qtd }} {{ f.unidadeCodigo }}, há {{ f.reservavel | qtd }} disponível — faltam <strong>{{ f.falta | qtd }} {{ f.unidadeCodigo }}</strong></li>
            }
          </ul>
          <button type="button" class="btn btn-sm btn-warning me-2" [disabled]="agindo()" (click)="liberar(true)">Liberar mesmo assim</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" (click)="faltas.set([])">Voltar</button>
        </div>
      }

      @if (permissao.pode(['producao.ordens.liberar', 'producao.ordens.iniciar', 'producao.ordens.cancelar']) && !terminal()) {
        <div class="d-flex flex-wrap gap-2 mb-3">
          @if (o.status === 'planejada') { <button class="btn btn-primary" [disabled]="agindo()" (click)="liberar(false)">Liberar (reservar materiais)</button> }
          @if (o.status === 'liberada') { <button class="btn btn-primary" [disabled]="agindo()" (click)="iniciar()">Iniciar produção</button> }
          @if (o.status === 'em_producao') { <button class="btn btn-primary" [disabled]="agindo()" (click)="concluir()">Concluir</button> }
          @if (o.status === 'liberada' || o.status === 'em_producao') {
            <a class="btn btn-outline-primary" routerLink="/producao/faccao/nova" [queryParams]="{ ordemId: o.id }">Enviar para terceirização</a>
          }
          <button class="btn btn-outline-danger" [disabled]="agindo()" (click)="pedindoCancelamento.set(true)">Cancelar ordem</button>
        </div>
      }

      @if (pedindoCancelamento()) {
        <div class="card card-body mb-3">
          <label class="form-label" for="motivo">Motivo do cancelamento</label>
          <input id="motivo" class="form-control mb-2" maxlength="500" [(ngModel)]="motivo">
          <div>
            <button class="btn btn-danger btn-sm me-2" [disabled]="agindo() || !motivo.trim()" (click)="cancelar()">Confirmar cancelamento</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="pedindoCancelamento.set(false)">Voltar</button>
          </div>
        </div>
      }

      <h2 class="h6">Quantidade por tamanho</h2>
      <ul class="list-inline small">
        @for (i of o.itens; track $index) {
          <li class="list-inline-item"><strong>{{ i.variacaoSku ?? 'Quantidade' }}</strong>: {{ i.cortado | qtd }} cortadas · {{ i.apontado | qtd }} de {{ i.quantidade | qtd }} apontadas</li>
        }
      </ul>

      @if (o.status === 'liberada' || o.status === 'em_producao' || o.status === 'concluida') {
        <app-corte-ordem [ordem]="o" (registrado)="carregar()" />
        <app-lotes-ordem [ordem]="o" />
      }

      @if (o.status === 'em_producao' && permissao.pode(['producao.ordens.apontamentos', 'producao.ordens.concluir'])) {
        <div class="card card-body mb-3">
          <h2 class="h6">Apontar produção</h2>
          <p class="small text-secondary mb-2">Informe as peças boas. Os materiais são baixados pelo consumo da ficha (com a perda prevista) e as peças entram no estoque, tudo de uma vez.</p>
          @if (sobreproducao().length > 0) {
            <div class="alert alert-warning" role="alert">
              <strong>Passa do planejado:</strong>
              <ul class="mb-2">
                @for (s of sobreproducao(); track $index) {
                  <li>{{ s.variacaoSku ?? 'Quantidade' }}: planejado {{ s.planejado | qtd }}, já apontado {{ s.apontado | qtd }} — {{ s.excesso | qtd }} a mais</li>
                }
              </ul>
              <button type="button" class="btn btn-sm btn-warning me-2" [disabled]="agindo()" (click)="apontar(true)">Apontar mesmo assim</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="sobreproducao.set([])">Voltar</button>
            </div>
          }
          @for (l of linhasApontar; track $index) {
            <div class="border-bottom py-2">
              <div class="row g-2 align-items-center">
                <div class="col-4 col-md-3"><strong>{{ l.rotulo }}</strong> <span class="small text-secondary">({{ l.apontado | qtd }}/{{ l.planejado | qtd }})</span></div>
                <div class="col-4 col-md-2">
                  <input class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="l.quantidade" [attr.aria-label]="'Peças ' + l.rotulo">
                </div>
                <div class="col-4 col-md-3">
                  <button type="button" class="btn btn-sm btn-link" (click)="alternarAjuste(l)">{{ l.ajustando ? 'Usar consumo da ficha' : 'Ajustar consumo' }}</button>
                </div>
              </div>
              @if (l.ajustando) {
                @for (a of l.consumos; track a.materialId) {
                  <div class="row g-2 align-items-center mt-1 ms-md-3">
                    <div class="col-12 col-md-3 small">{{ a.nome }} <span class="text-secondary">(previsto {{ previsto(l, a) | qtd }} {{ a.unidade }})</span></div>
                    <div class="col-6 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="real" [(ngModel)]="a.real" [attr.aria-label]="'Consumo real ' + a.nome"></div>
                    <div class="col-6 col-md-4"><input class="form-control form-control-sm" maxlength="500" placeholder="motivo da diferença" [(ngModel)]="a.motivo" [attr.aria-label]="'Motivo ' + a.nome"></div>
                  </div>
                }
              }
            </div>
          }
          <div class="row g-2 mt-1 align-items-end">
            <div class="col-6 col-md-3">
              <label class="form-label small mb-1" for="mdo-apontar">Mão de obra por peça (R$)</label>
              <input id="mdo-apontar" class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="maoDeObra">
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label small mb-1" for="ind-apontar">Custos indiretos por peça (R$)</label>
              <input id="ind-apontar" class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="indiretos">
            </div>
            <div class="col-12 col-md-6 small text-secondary">
              Entram no custo com que a peça vai para o estoque (junto com o material e o tecido do corte). Já vêm preenchidos com os da ficha;
              altere ou deixe 0 para não considerar.
            </div>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary" [disabled]="agindo() || totalApontar() <= 0" (click)="apontar(false)">Apontar</button>
          </div>
        </div>
      }

      <h2 class="h6">Materiais</h2>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr><th>Material</th><th class="text-end">Necessário</th><th class="text-end">Reservado</th><th class="text-end">Disponível</th><th class="text-end">Falta</th></tr>
          </thead>
          <tbody>
            @for (m of o.materiais; track m.materialId) {
              <tr>
                <td>{{ m.materialNome }} <span class="text-secondary">({{ m.unidadeCodigo }})</span></td>
                <td class="text-end">{{ m.necessidade | qtd }}</td>
                <td class="text-end">{{ m.reservado | qtd }}</td>
                <td class="text-end">{{ terminal() ? '—' : (m.disponivel | qtd) }}</td>
                <td class="text-end" [class.text-danger]="m.falta > 0">{{ m.falta > 0 ? (m.falta | qtd) : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (apontamentos().length > 0) {
        <h2 class="h6">Apontamentos</h2>
        <ul class="small">
          @for (a of apontamentos(); track a.id) {
            <li>
              {{ a.criadoEm.slice(0, 10) }} · {{ a.variacaoSku ?? 'Quantidade' }}: <strong>{{ a.quantidade | qtd }}</strong> peça(s)
              @if (a.sobreproducao) { <span class="badge text-bg-warning">sobreprodução</span> }
              @if (a.custoUnitario !== null) { · custo {{ moeda(a.custoUnitario) }}/peça } @else { · custo incompleto }
              @if (a.maoDeObraUnitaria > 0 || a.custosIndiretosUnitarios > 0) {
                <span class="text-secondary">(inclui mão de obra {{ moeda(a.maoDeObraUnitaria) }} e indiretos {{ moeda(a.custosIndiretosUnitarios) }})</span>
              }
              {{ a.usuarioNome ? ' · ' + a.usuarioNome : '' }}
              @for (c of a.consumos; track c.materialId) {
                @if (c.real !== c.previsto) {
                  <div class="text-secondary ms-3">{{ c.materialNome }}: previsto {{ c.previsto | qtd }}, real {{ c.real | qtd }} {{ c.unidadeCodigo }}{{ c.motivo ? ' — ' + c.motivo : '' }}</div>
                }
              }
            </li>
          }
        </ul>
      }

      @if (temApontado()) {
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span class="small">Etiquetas das peças apontadas:</span>
          <select class="form-select form-select-sm w-auto" aria-label="Modelo da etiqueta" [(ngModel)]="modeloEtiqueta">
            @for (m of modelosEtiqueta; track m.codigo) { <option [value]="m.codigo">{{ m.descricao }}</option> }
          </select>
          <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="agindo()" (click)="imprimirEtiquetas()">Imprimir etiquetas</button>
        </div>
      }

      <h2 class="h6">Histórico</h2>
      <ul class="small">
        @for (e of o.historico; track $index) {
          <li>{{ rotulo[e.paraStatus] }} · {{ e.criadoEm.slice(0, 10) }}{{ e.usuarioNome ? ' · ' + e.usuarioNome : '' }}{{ e.motivo ? ' · ' + e.motivo : '' }}</li>
        }
      </ul>
    } @else if (erro()) {
      <div class="alert alert-danger mt-2" role="alert">{{ erro() }}</div>
    } @else {
      <p class="text-secondary mt-2">Carregando…</p>
    }
  `
})
export class OrdemDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(OrdemProducaoService);
  private toast = inject(ToastService);
  private fichas = inject(FichaTecnicaService);
  private etiquetas = inject(EtiquetaAcabadoService);
  permissao = inject(PermissaoService);

  readonly rotulo = ROTULO_STATUS_ORDEM;
  ordem = signal<OrdemProducao | null>(null);
  faltas = signal<FaltaMaterial[]>([]);
  erro = signal('');
  agindo = signal(false);
  pedindoCancelamento = signal(false);
  motivo = '';
  readonly modelosEtiqueta = MODELOS_ETIQUETA_ACABADO;
  modeloEtiqueta = MODELOS_ETIQUETA_ACABADO[0].codigo;
  apontamentos = signal<Apontamento[]>([]);
  sobreproducao = signal<Sobreproducao[]>([]);
  linhasApontar: LinhaApontar[] = [];
  maoDeObra: number | null = 0;
  indiretos: number | null = 0;
  private id = 0;

  terminal = computed(() => this.ordem()?.status === 'concluida' || this.ordem()?.status === 'cancelada');

  ngOnInit() {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.carregar();
  }

  data(iso: string) {
    return formatarData(iso);
  }

  carregar() {
    this.service.obter(this.id).subscribe({
      next: o => { this.ordem.set(o); this.prepararApontamento(o); this.carregarApontamentos(); },
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Ordem não encontrada.'), 'Ordem não encontrada.'))
    });
  }

  private carregarApontamentos() {
    this.service.apontamentos(this.id).subscribe({ next: a => this.apontamentos.set(a), error: () => this.apontamentos.set([]) });
  }

  private prepararApontamento(o: OrdemProducao) {
    this.maoDeObra = o.fichaMaoDeObra ?? 0;
    this.indiretos = o.fichaCustosIndiretos ?? 0;
    this.linhasApontar = o.status !== 'em_producao' ? [] : o.itens.map(i => ({
      variacaoId: i.variacaoId, rotulo: i.variacaoSku ?? 'Quantidade', planejado: i.quantidade, apontado: i.apontado,
      quantidade: null, ajustando: false, consumos: []
    }));
  }

  temApontado() {
    return (this.ordem()?.itens ?? []).some(i => i.apontado >= 1);
  }

  imprimirEtiquetas() {
    const o = this.ordem();
    if (!o) return;
    this.erro.set('');
    this.etiquetas.daOrdem(o.id, this.modeloEtiqueta).subscribe({
      next: blob => baixarBlob(blob, `etiquetas-ordem-${o.numero}.pdf`),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível gerar as etiquetas.'), 'Não foi possível gerar as etiquetas.'))
    });
  }

  totalApontar() {
    return this.linhasApontar.reduce((s, l) => s + (Number(l.quantidade) > 0 ? Number(l.quantidade) : 0), 0);
  }

  previsto(l: LinhaApontar, a: AjusteConsumo) {
    return Math.round((Number(l.quantidade) || 0) * a.porPeca * 10000) / 10000;
  }

  moeda(valor: number | null) {
    return valor === null ? '—' : MOEDA.format(valor);
  }

  alternarAjuste(l: LinhaApontar) {
    l.ajustando = !l.ajustando;
    const o = this.ordem();
    if (!l.ajustando || l.consumos.length > 0 || !o) return;
    this.fichas.consumo(o.fichaId, l.variacaoId).subscribe(cs => {
      l.consumos = cs.map(c => ({ materialId: c.materialId, nome: c.materialNome, unidade: c.unidadeCodigo, porPeca: c.quantidadeComPerda, real: null, motivo: '' }));
    });
  }

  apontar(confirmarSobreproducao: boolean) {
    this.agindo.set(true);
    this.erro.set('');
    this.service.apontar(this.id, {
      confirmarSobreproducao, observacao: null,
      maoDeObraPorPeca: this.valorOuNulo(this.maoDeObra), custosIndiretosPorPeca: this.valorOuNulo(this.indiretos),
      itens: this.linhasApontar.filter(l => Number(l.quantidade) > 0).map(l => ({
        variacaoId: l.variacaoId, quantidade: Number(l.quantidade),
        consumos: l.ajustando
          ? l.consumos.filter(a => a.real !== null && String(a.real) !== '').map(a => ({ materialId: a.materialId, quantidade: Number(a.real), motivo: a.motivo.trim() || null }))
          : []
      }))
    }).subscribe({
      next: r => {
        this.agindo.set(false);
        if (!r.registrado) { this.sobreproducao.set(r.sobreproducao); return; }
        this.sobreproducao.set([]);
        this.ordem.set(r.ordem);
        this.prepararApontamento(r.ordem);
        this.carregarApontamentos();
        this.toast.sucesso(r.ordemConcluida ? 'Produção apontada: todas as peças foram produzidas e a ordem foi concluída.' : 'Produção apontada.');
      },
      error: err => this.falha(err, 'Não foi possível apontar a produção.')
    });
  }

  /** Campo vazio = usar o da ficha (o servidor assume); 0 digitado = não considerar. */
  private valorOuNulo(v: number | null) {
    return v === null || String(v).trim() === '' ? null : Number(v);
  }

  private falha(err: unknown, padrao: string) {
    this.agindo.set(false);
    this.erro.set(textoDoErro(lerErroApi(err, padrao), padrao));
  }

  liberar(confirmarFalta: boolean) {
    this.agindo.set(true);
    this.erro.set('');
    this.service.liberar(this.id, confirmarFalta).subscribe({
      next: r => {
        this.agindo.set(false);
        this.ordem.set(r.ordem);
        this.faltas.set(r.liberada ? [] : r.faltas);
        if (r.liberada) this.toast.sucesso(r.faltas.length > 0 ? 'Ordem liberada com material faltando.' : 'Ordem liberada: materiais reservados.');
      },
      error: err => this.falha(err, 'Não foi possível liberar a ordem.')
    });
  }

  iniciar() {
    this.agir(this.service.iniciar(this.id), 'Produção iniciada.', 'Não foi possível iniciar a ordem.');
  }

  concluir() {
    this.agir(this.service.concluir(this.id), 'Ordem concluída.', 'Não foi possível concluir a ordem.');
  }

  cancelar() {
    this.agir(this.service.cancelar(this.id, this.motivo.trim()), 'Ordem cancelada; reserva liberada.', 'Não foi possível cancelar a ordem.');
  }

  private agir(chamada: ReturnType<OrdemProducaoService['iniciar']>, sucesso: string, padrao: string) {
    this.agindo.set(true);
    this.erro.set('');
    chamada.subscribe({
      next: o => {
        this.agindo.set(false);
        this.pedindoCancelamento.set(false);
        this.motivo = '';
        this.ordem.set(o);
        this.toast.sucesso(sucesso);
      },
      error: err => this.falha(err, padrao)
    });
  }
}
