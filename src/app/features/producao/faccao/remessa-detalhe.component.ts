import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaccaoService } from '../../../core/services/faccao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ToastService } from '../../../core/services/toast.service';
import { ROTULO_STATUS_REMESSA, Remessa } from '../../../core/models/faccao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { baixarBlob } from '../../../core/utils/download';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface LinhaRetorno {
  variacaoId: number | null;
  rotulo: string;
  emPoder: number;
  boas: number | null;
  defeituosas: number | null;
}

interface LinhaDevolucao {
  materialId: number;
  nome: string;
  unidade: string;
  emPoder: number;
  devolvido: number | null;
}

/**
 * Remessa ao terceirizado: o que está em poder dela, retornos (parciais ou final) com defeitos e sobra de aviamento, valor a pagar,
 * perda registrada ao encerrar com diferença e o romaneio em PDF.
 */
@Component({
  selector: 'app-remessa-detalhe',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <a routerLink="/producao/faccao" class="small">← Terceirização</a>
    @if (remessa(); as r) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-1 mb-1">
        <h1 class="h4 mb-0">Remessa {{ r.numero }}</h1>
        <span class="badge text-bg-secondary">{{ rotulo[r.status] }}</span>
        @if (r.atrasada) { <span class="badge text-bg-danger">atrasada</span> }
        <button type="button" class="btn btn-sm btn-outline-primary ms-auto" (click)="baixarRomaneio()">Romaneio (PDF)</button>
      </div>
      <p class="text-secondary small">
        {{ r.fornecedorNome }} · <a [routerLink]="['/producao/ordens', r.ordemId]">ordem {{ r.ordemNumero }}</a> · {{ r.produtoNome }}
        · {{ moeda(r.valorPeca) }} por peça
        @if (r.prazoRetorno) { · retorno até {{ data(r.prazoRetorno) }} }
        @if (r.status !== 'concluida') { · há {{ r.diasEmAberto }} dia(s) }
      </p>

      @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Enviadas</small><strong>{{ r.pecasEnviadas | qtd }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Boas</small><strong>{{ r.pecasBoas | qtd }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Em poder do terceirizado</small><strong>{{ r.pecasEmPoder | qtd }}</strong></div></div>
        <div class="col-6 col-md-3"><div class="card card-body py-2"><small class="text-secondary">Valor a pagar</small><strong>{{ moeda(r.valorPagar) }}</strong></div></div>
      </div>
      @if (r.perdidas > 0) {
        <div class="alert alert-warning small py-2" role="status">{{ r.perdidas | qtd }} peça(s) não voltaram e foram registradas como perda ao encerrar.</div>
      }

      <h2 class="h6">Por tamanho</h2>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Tamanho</th><th class="text-end">Enviadas</th><th class="text-end">Boas</th><th class="text-end">Defeituosas</th><th class="text-end">Em poder</th></tr></thead>
          <tbody>
            @for (i of r.itens; track $index) {
              <tr><td>{{ i.variacaoSku ?? 'Peças' }}</td><td class="text-end">{{ i.enviadas | qtd }}</td><td class="text-end">{{ i.boas | qtd }}</td>
                <td class="text-end">{{ i.defeituosas | qtd }}</td><td class="text-end">{{ i.emPoder | qtd }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (r.materiais.length > 0) {
        <h2 class="h6">Aviamentos</h2>
        <ul class="small">
          @for (m of r.materiais; track m.materialId) {
            <li>{{ m.materialNome }}: enviado {{ m.enviado | qtd }} {{ m.unidadeCodigo }}, devolvido {{ m.devolvido | qtd }}, com o terceirizado/consumido {{ m.emPoder | qtd }}</li>
          }
        </ul>
      }

      @if (r.status !== 'concluida' && permissao.pode('producao.faccao-remessas.retornos')) {
        <div class="card card-body mb-3">
          <h2 class="h6">Registrar retorno</h2>
          @for (l of linhas; track $index) {
            <div class="row g-2 align-items-center mb-1">
              <div class="col-3 col-md-2"><strong>{{ l.rotulo }}</strong> <span class="small text-secondary">({{ l.emPoder | qtd }})</span></div>
              <div class="col-4 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="boas" [(ngModel)]="l.boas" [attr.aria-label]="'Boas ' + l.rotulo"></div>
              <div class="col-5 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="defeituosas" [(ngModel)]="l.defeituosas" [attr.aria-label]="'Defeituosas ' + l.rotulo"></div>
            </div>
          }
          @for (d of devolucoes; track d.materialId) {
            <div class="row g-2 align-items-center mb-1">
              <div class="col-12 col-md-4 small">Sobra de {{ d.nome }} ({{ d.unidade }}) — com o terceirizado: {{ d.emPoder | qtd }}</div>
              <div class="col-6 col-md-2"><input class="form-control form-control-sm" type="number" min="0" step="any" placeholder="devolvido" [(ngModel)]="d.devolvido" [attr.aria-label]="'Devolvido ' + d.nome"></div>
            </div>
          }
          <div class="row g-2 mt-1 align-items-end">
            <div class="col-6 col-md-3">
              <label class="form-label small mb-1" for="ind-retorno">Custos indiretos por peça (R$)</label>
              <input id="ind-retorno" class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="indiretos">
            </div>
            <div class="col-12 col-md-9 small text-secondary">
              Entram no custo das peças boas, junto com o preço do terceirizado, os aviamentos e o tecido do corte. Já vêm da ficha; altere ou deixe 0 para não considerar.
            </div>
          </div>
          <input class="form-control form-control-sm mt-2" maxlength="500" placeholder="Observações do retorno" aria-label="Observações do retorno" [(ngModel)]="observacao">
          <div class="form-check mt-2">
            <input id="encerrar" class="form-check-input" type="checkbox" [(ngModel)]="encerrar">
            <label class="form-check-label small" for="encerrar">Encerrar a remessa (o que não voltou vira perda registrada)</label>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary btn-sm" [disabled]="agindo() || !podeReceber()" (click)="receber()">Registrar retorno</button>
          </div>
        </div>
      }

      @if (r.retornos.length > 0) {
        <h2 class="h6">Retornos</h2>
        <ul class="small">
          @for (t of r.retornos; track t.id) {
            <li>{{ t.criadoEm.slice(0, 10) }}{{ t.usuarioNome ? ' · ' + t.usuarioNome : '' }} ·
              @for (i of t.itens; track $index) { {{ i.variacaoSku ?? 'Peças' }}: {{ i.boas | qtd }} boas / {{ i.defeituosas | qtd }} def. }
              · {{ moeda(t.valorPagar) }}
              @if (t.encerrou) { <span class="badge text-bg-secondary">encerrou</span> }
              @if (t.observacao) { · {{ t.observacao }} }
            </li>
          }
        </ul>
      }
    } @else if (erro()) {
      <div class="alert alert-danger mt-2" role="alert">{{ erro() }}</div>
    } @else {
      <p class="text-secondary mt-2">Carregando…</p>
    }
  `
})
export class RemessaDetalheComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(FaccaoService);
  private toast = inject(ToastService);
  permissao = inject(PermissaoService);

  readonly rotulo = ROTULO_STATUS_REMESSA;
  remessa = signal<Remessa | null>(null);
  erro = signal('');
  agindo = signal(false);
  linhas: LinhaRetorno[] = [];
  devolucoes: LinhaDevolucao[] = [];
  observacao = '';
  encerrar = false;
  indiretos: number | null = 0;
  private id = 0;

  ngOnInit() {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.carregar();
  }

  data(iso: string) {
    return formatarData(iso);
  }

  moeda(valor: number) {
    return formatarMoeda(valor);
  }

  private carregar() {
    this.service.obter(this.id).subscribe({
      next: r => this.definir(r),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Remessa não encontrada.'), 'Remessa não encontrada.'))
    });
  }

  private definir(r: Remessa) {
    this.remessa.set(r);
    this.linhas = r.itens.filter(i => i.emPoder > 0).map(i => ({ variacaoId: i.variacaoId, rotulo: i.variacaoSku ?? 'Peças', emPoder: i.emPoder, boas: null, defeituosas: null }));
    this.devolucoes = r.materiais.filter(m => m.emPoder > 0).map(m => ({ materialId: m.materialId, nome: m.materialNome, unidade: m.unidadeCodigo, emPoder: m.emPoder, devolvido: null }));
    this.observacao = '';
    this.encerrar = false;
    this.indiretos = r.fichaCustosIndiretos ?? 0;
  }

  podeReceber() {
    return this.encerrar || this.linhas.some(l => Number(l.boas) > 0 || Number(l.defeituosas) > 0) || this.devolucoes.some(d => Number(d.devolvido) > 0);
  }

  receber() {
    this.agindo.set(true);
    this.erro.set('');
    this.service.receber(this.id, {
      encerrar: this.encerrar, observacao: this.observacao.trim() || null,
      custosIndiretosPorPeca: this.indiretos === null || String(this.indiretos).trim() === '' ? null : Number(this.indiretos),
      itens: this.linhas.filter(l => Number(l.boas) > 0 || Number(l.defeituosas) > 0)
        .map(l => ({ variacaoId: l.variacaoId, boas: Number(l.boas) || 0, defeituosas: Number(l.defeituosas) || 0 })),
      materiais: this.devolucoes.filter(d => Number(d.devolvido) > 0).map(d => ({ materialId: d.materialId, devolvido: Number(d.devolvido) }))
    }).subscribe({
      next: r => {
        this.agindo.set(false);
        this.definir(r.remessa);
        this.toast.sucesso(r.ordemConcluida ? 'Retorno registrado: todas as peças foram produzidas e a ordem foi concluída.'
          : r.remessaConcluida ? 'Retorno registrado: remessa encerrada.' : 'Retorno registrado.');
      },
      error: err => {
        this.agindo.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível registrar o retorno.'), 'Não foi possível registrar o retorno.'));
      }
    });
  }

  baixarRomaneio() {
    const r = this.remessa();
    if (!r) return;
    this.service.romaneio(r.id).subscribe({
      next: blob => baixarBlob(blob, `romaneio-terceirizacao-${r.numero}.pdf`),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível gerar o romaneio.'), 'Não foi possível gerar o romaneio.'))
    });
  }
}
