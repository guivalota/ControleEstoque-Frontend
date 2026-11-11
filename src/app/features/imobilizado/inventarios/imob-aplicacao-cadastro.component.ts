import { Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobConferenciaService } from '../../../core/services/imob-conferencia.service';
import {
  CampoAplicavel, ImobAplicacaoItemResultado, ImobAplicacaoLinha, ImobAplicacaoPedidoItem, ImobAplicacaoPrevia,
  ImobAplicacaoResposta, ROTULO_SITUACAO_APLICACAO, SituacaoAplicacao
} from '../../../core/models/imob-leitura.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 20;

/** `bemId:campo` — chave de cada célula marcada. */
const chave = (bemId: number, campo: CampoAplicavel) => `${bemId}:${campo}`;

/**
 * Aplicar ao cadastro o que foi encontrado na conferência (E28 / US-28-04, DSG-30 R6): opcional, depois do ciclo concluído, por
 * bem e por campo (departamento e estado de conservação), com prévia "cadastro atual → encontrado". Desfazer é uma nova
 * aplicação com o valor anterior. O local não é aplicado aqui (conciliação ou OS de transferência).
 */
@Component({
  selector: 'app-imob-aplicacao-cadastro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent, ConfirmDialogComponent],
  template: `
    <div class="card border-0 shadow-sm mb-3" data-testid="aplicacao-cadastro">
      <div class="card-header bg-transparent d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <span class="fw-semibold">Aplicar ao cadastro</span>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <select class="form-select form-select-sm w-auto" aria-label="Situação" [formControl]="situacao" (change)="carregar(1)">
            @for (s of situacoes; track s) { <option [ngValue]="s">{{ rotulo[s] }}</option> }
          </select>
          <input class="form-control form-control-sm" placeholder="Filtrar plaqueta ou descrição" aria-label="Filtrar aplicação"
                 [formControl]="busca" (keydown.enter)="carregar(1)">
        </div>
      </div>

      <div class="card-body py-2">
        <p class="small text-muted mb-2">
          A conferência <strong>não altera o cadastro sozinha</strong>. Marque o que deve atualizar o bem (departamento e/ou estado de
          conservação) e aplique; tudo fica registrado no histórico do bem e pode ser desfeito. O <strong>local</strong> não é aplicado
          aqui: use a <a [routerLink]="['/imobilizado/inventarios', inventarioId(), 'conciliacao']">conciliação</a> ou uma OS de transferência.
        </p>
        @if (previa(); as p) {
          @if (!p.podeAplicar) {
            <div class="alert alert-info py-2 mb-2" role="status" data-testid="aviso-nao-concluido">
              Só é possível aplicar ao cadastro depois que o inventário for <strong>concluído</strong> (situação atual: {{ p.inventarioStatus }}).
            </div>
          }
        }
        @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }
        @if (resposta(); as r) {
          <div class="alert py-2" [class.alert-success]="r.naoAplicados === 0" [class.alert-warning]="r.naoAplicados > 0" role="status" data-testid="resposta-aplicacao">
            {{ r.aplicados }} aplicado(s), {{ r.revertidos }} desfeito(s), {{ r.semMudanca }} sem mudança, {{ r.naoAplicados }} não aplicado(s).
            @if (naoAplicados().length) {
              <ul class="mb-0 mt-1 small">
                @for (i of naoAplicados(); track i.bemId + i.campo) { <li>{{ plaquetaDe(i.bemId) }} · {{ rotuloCampo(i.campo) }}: {{ i.mensagem || i.resultado }}</li> }
              </ul>
            }
          </div>
        }
      </div>

      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr><th>Plaqueta</th><th>Departamento (cadastro → encontrado)</th><th>Estado de conservação (cadastro → encontrado)</th><th>Local</th></tr>
          </thead>
          <tbody>
            @for (l of linhas(); track l.bemId) {
              <tr>
                <td>
                  {{ l.plaqueta }}
                  @if (l.descricao) { <div class="small text-muted">{{ l.descricao }}</div> }
                  @if (!l.aplicavel) { <span class="badge bg-secondary">Bem baixado/vendido</span> }
                </td>
                <td>
                  @if (l.departamentoEncontradoId !== null && l.departamentoEncontradoId !== undefined) {
                    <label class="d-flex gap-2 align-items-start">
                      <input type="checkbox" class="form-check-input mt-1" [attr.aria-label]="'Departamento de ' + l.plaqueta"
                             [checked]="marcada(l.bemId, 'departamento_id')" [disabled]="!podeMarcarDepto(l)"
                             (change)="alternar(l.bemId, 'departamento_id')">
                      <span>
                        {{ l.departamentoAtualNome || '—' }} → <strong>{{ l.departamentoEncontradoNome }}</strong>
                        @if (l.departamentoAplicado) { <span class="badge bg-success-subtle text-success-emphasis ms-1">Aplicado</span> }
                        @else if (!l.departamentoDiferente) { <span class="badge bg-light text-dark border ms-1">Igual</span> }
                        @else if (l.departamentoCadastroAlterado) {
                          <span class="badge bg-warning-subtle text-warning-emphasis ms-1" title="O cadastro mudou depois do início do ciclo: será pedida confirmação.">Cadastro mudou</span>
                        }
                      </span>
                    </label>
                  } @else { <span class="text-muted">não informado</span> }
                </td>
                <td>
                  @if (l.estadoEncontradoId !== null && l.estadoEncontradoId !== undefined) {
                    <label class="d-flex gap-2 align-items-start">
                      <input type="checkbox" class="form-check-input mt-1" [attr.aria-label]="'Estado de ' + l.plaqueta"
                             [checked]="marcada(l.bemId, 'estado_conservacao_id')" [disabled]="!podeMarcarEstado(l)"
                             (change)="alternar(l.bemId, 'estado_conservacao_id')">
                      <span>
                        {{ l.estadoAtualNome || '—' }} → <strong>{{ l.estadoEncontradoNome }}</strong>
                        @if (l.estadoAplicado) { <span class="badge bg-success-subtle text-success-emphasis ms-1">Aplicado</span> }
                        @else if (!l.estadoDiferente) { <span class="badge bg-light text-dark border ms-1">Igual</span> }
                      </span>
                    </label>
                  } @else { <span class="text-muted">não informado</span> }
                </td>
                <td>
                  @if (l.localDivergente) {
                    <span class="badge bg-warning-subtle text-warning-emphasis" data-testid="local-divergente"
                          [title]="'Cadastro: ' + (l.localCadastroNome || '—') + ' · Lido: ' + (l.localLidoNome || '—')">Lido em outro local</span>
                  } @else { <span class="text-muted">—</span> }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="text-center text-muted py-3">{{ carregando() ? 'Carregando...' : 'Nenhum bem para este filtro.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="card-footer bg-transparent d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <span class="small text-muted">{{ totalMarcadas() }} campo(s) marcado(s)</span>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-primary" data-testid="aplicar"
                  [disabled]="!previa()?.podeAplicar || executando() || aAplicar().length === 0" (click)="executar('aplicar')">
            @if (executando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Aplicar marcados
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary" data-testid="desfazer"
                  [disabled]="!previa()?.podeAplicar || executando() || aDesfazer().length === 0" (click)="executar('reverter')">
            Desfazer marcados
          </button>
        </div>
      </div>
      <app-paginacao [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="carregando()" (mudar)="carregar($event)" />
    </div>
    <app-confirm-dialog />
  `
})
export class ImobAplicacaoCadastroComponent implements OnInit {
  private service = inject(ImobConferenciaService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  inventarioId = input.required<number>();

  readonly pageSize = PAGE_SIZE;
  readonly rotulo = ROTULO_SITUACAO_APLICACAO;
  readonly situacoes = Object.keys(ROTULO_SITUACAO_APLICACAO) as SituacaoAplicacao[];

  situacao = new FormControl<SituacaoAplicacao>('diferencas', { nonNullable: true });
  busca = new FormControl('', { nonNullable: true });

  previa = signal<ImobAplicacaoPrevia | null>(null);
  linhas = signal<ImobAplicacaoLinha[]>([]);
  total = signal(0);
  page = signal(1);
  carregando = signal(true);
  executando = signal(false);
  erro = signal('');
  resposta = signal<ImobAplicacaoResposta | null>(null);
  naoAplicados = signal<ImobAplicacaoItemResultado[]>([]);
  /** Células marcadas (`bemId:campo`), mantidas entre páginas. */
  marcadas = signal<ReadonlySet<string>>(new Set());

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page = this.page()) {
    this.carregando.set(true);
    this.erro.set('');
    this.service.previaAplicacao(this.inventarioId(), {
      situacao: this.situacao.value, busca: this.busca.value.trim() || undefined, page, pageSize: PAGE_SIZE
    }).subscribe({
      next: r => {
        this.previa.set(r); this.linhas.set(r.items); this.total.set(r.total); this.page.set(r.page); this.carregando.set(false);
      },
      error: err => { this.carregando.set(false); this.erro.set(lerErroApi(err, 'Não foi possível carregar a prévia da aplicação.').mensagem); }
    });
  }

  rotuloCampo(campo: string): string {
    return campo === 'departamento_id' ? 'Departamento' : campo === 'estado_conservacao_id' ? 'Estado de conservação' : campo;
  }

  plaquetaDe(bemId: number): string {
    return this.linhas().find(l => l.bemId === bemId)?.plaqueta ?? `#${bemId}`;
  }

  marcada(bemId: number, campo: CampoAplicavel): boolean {
    return this.marcadas().has(chave(bemId, campo));
  }

  alternar(bemId: number, campo: CampoAplicavel) {
    const k = chave(bemId, campo);
    this.marcadas.update(m => {
      const n = new Set(m);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  /** Marcável: bem aplicável e há o que aplicar (difere) ou o que desfazer (já aplicado). */
  podeMarcarDepto(l: ImobAplicacaoLinha): boolean {
    return l.aplicavel && (l.departamentoDiferente || l.departamentoAplicado);
  }

  podeMarcarEstado(l: ImobAplicacaoLinha): boolean {
    return l.aplicavel && (l.estadoDiferente || l.estadoAplicado);
  }

  totalMarcadas(): number { return this.marcadas().size; }

  private celulas(filtro: (l: ImobAplicacaoLinha, campo: CampoAplicavel) => boolean): ImobAplicacaoPedidoItem[] {
    const porBem = new Map<number, CampoAplicavel[]>();
    for (const l of this.linhas()) {
      for (const campo of ['departamento_id', 'estado_conservacao_id'] as CampoAplicavel[]) {
        if (this.marcada(l.bemId, campo) && filtro(l, campo)) porBem.set(l.bemId, [...(porBem.get(l.bemId) ?? []), campo]);
      }
    }
    return [...porBem].map(([bemId, campos]) => ({ bemId, campos }));
  }

  private aplicado(l: ImobAplicacaoLinha, c: CampoAplicavel) { return c === 'departamento_id' ? l.departamentoAplicado : l.estadoAplicado; }
  private diferente(l: ImobAplicacaoLinha, c: CampoAplicavel) { return c === 'departamento_id' ? l.departamentoDiferente : l.estadoDiferente; }

  /** Marcadas que diferem do cadastro e ainda não foram aplicadas. */
  aAplicar = () => this.celulas((l, c) => this.diferente(l, c) && !this.aplicado(l, c));
  /** Marcadas que já foram aplicadas. */
  aDesfazer = () => this.celulas((l, c) => this.aplicado(l, c));

  async executar(modo: 'aplicar' | 'reverter') {
    const itens = modo === 'aplicar' ? this.aAplicar() : this.aDesfazer();
    if (itens.length === 0 || this.executando()) return;
    const campos = itens.reduce((n, i) => n + i.campos.length, 0);
    const ok = await this.confirmDialog().abrir({
      titulo: modo === 'aplicar' ? 'Aplicar ao cadastro' : 'Desfazer a aplicação',
      mensagem: modo === 'aplicar'
        ? `Atualizar o cadastro de ${itens.length} bem(ns) com o que foi encontrado (${campos} campo(s))? Fica registrado no histórico do bem e pode ser desfeito.`
        : `Desfazer a aplicação em ${itens.length} bem(ns) (${campos} campo(s))? O cadastro volta ao valor anterior; o desfazer também fica registrado.`,
      confirmar: modo === 'aplicar' ? 'Aplicar' : 'Desfazer',
      perigo: modo !== 'aplicar'
    });
    if (!ok) return;
    await this.enviar(modo, itens, false);
  }

  private enviar(modo: 'aplicar' | 'reverter', itens: ImobAplicacaoPedidoItem[], confirmar: boolean, anterior?: ImobAplicacaoResposta): Promise<void> {
    this.executando.set(true);
    this.erro.set('');
    const chamada = modo === 'aplicar'
      ? this.service.aplicar(this.inventarioId(), itens, confirmar)
      : this.service.reverterAplicacao(this.inventarioId(), itens, confirmar);
    return new Promise(resolve => chamada.subscribe({
      next: async r => {
        this.executando.set(false);
        const alterados = r.itens.filter(i => i.resultado === 'cadastro_alterado');
        if (alterados.length > 0 && !confirmar) {
          const sim = await this.confirmDialog().abrir({
            titulo: 'O cadastro mudou depois da conferência',
            mensagem: `${alterados.length} item(ns) tiveram o cadastro alterado depois do início do ciclo. ${modo === 'aplicar' ? 'Aplicar' : 'Desfazer'} mesmo assim?`,
            confirmar: 'Continuar mesmo assim',
            perigo: true
          });
          if (sim) {
            const pendentes = alterados.map(a => ({ bemId: a.bemId, campos: [a.campo as CampoAplicavel] }));
            // o que já foi gravado nesta rodada (sem os itens que pediram confirmação) segue no resumo final
            await this.enviar(modo, pendentes, true, { ...r, itens: r.itens.filter(i => i.resultado !== 'cadastro_alterado'), naoAplicados: r.naoAplicados - alterados.length });
            return resolve();
          }
        }
        const final: ImobAplicacaoResposta = anterior
          ? { aplicados: anterior.aplicados + r.aplicados, revertidos: anterior.revertidos + r.revertidos, semMudanca: anterior.semMudanca + r.semMudanca,
              naoAplicados: anterior.naoAplicados + r.naoAplicados, itens: [...anterior.itens, ...r.itens] }
          : r;
        this.resposta.set(final);
        this.naoAplicados.set(final.itens.filter(i => !['aplicado', 'revertido', 'sem_mudanca'].includes(i.resultado)));
        this.marcadas.set(new Set());
        this.carregar();
        resolve();
      },
      error: err => { this.executando.set(false); this.erro.set(lerErroApi(err, 'Não foi possível concluir a operação.').mensagem); resolve(); }
    }));
  }
}
