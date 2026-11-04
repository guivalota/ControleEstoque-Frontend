import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaccaoService } from '../../../core/services/faccao.service';
import { FornecedorService } from '../../../core/services/fornecedor.service';
import { OrdemProducaoService } from '../../../core/services/ordem-producao.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrdemProducao } from '../../../core/models/ordem-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface LinhaPeca {
  variacaoId: number | null;
  rotulo: string;
  planejado: number;
  cortado: number;
  quantidade: number | null;
}

interface LinhaAviamento {
  materialId: number;
  nome: string;
  unidade: string;
  disponivel: number;
  quantidade: number | null;
}

/**
 * Nova remessa ao terceirizado, a partir de uma ordem (`?ordemId=`): peças por tamanho (até o que foi cortado, ou o planejado se não
 * houve corte, menos o já enviado) e aviamentos que seguem junto (saem do estoque próprio e ficam em poder do terceirizado).
 */
@Component({
  selector: 'app-remessa-form',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <a routerLink="/producao/faccao" class="small">← Terceirização</a>
    <h1 class="h4 mt-1 mb-1">Nova remessa ao terceirizado</h1>
    @if (ordem(); as o) {
      <p class="text-secondary small">Ordem {{ o.numero }} · {{ o.produtoSku }} — {{ o.produtoNome }}</p>

      @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

      <div class="row g-2 mb-3">
        <div class="col-12 col-md-5">
          <label class="form-label" for="oficina">Terceirizado (fornecedor)</label>
          <select id="oficina" class="form-select" [(ngModel)]="fornecedorId">
            <option [ngValue]="null">Escolha…</option>
            @for (f of fornecedores.fornecedores(); track f.id) { <option [ngValue]="f.id">{{ f.razaoSocial }}</option> }
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label" for="preco">Preço por peça (R$)</label>
          <input id="preco" class="form-control" type="number" min="0" step="any" [(ngModel)]="valorPeca">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label" for="prazo">Retorno combinado</label>
          <input id="prazo" class="form-control" type="date" [(ngModel)]="prazo">
        </div>
      </div>

      <h2 class="h6">Peças a enviar</h2>
      @for (l of pecas; track $index) {
        <div class="row g-2 align-items-center mb-1">
          <div class="col-4 col-md-2"><strong>{{ l.rotulo }}</strong></div>
          <div class="col-4 col-md-2">
            <input class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="l.quantidade" [attr.aria-label]="'Peças ' + l.rotulo">
          </div>
          <div class="col-4 col-md-6 small text-secondary">planejado {{ l.planejado | qtd }} · cortado {{ l.cortado | qtd }}</div>
        </div>
      }

      @if (aviamentos.length > 0) {
        <h2 class="h6 mt-3">Aviamentos que vão junto (opcional)</h2>
        @for (a of aviamentos; track a.materialId) {
          <div class="row g-2 align-items-center mb-1">
            <div class="col-6 col-md-3">{{ a.nome }} <span class="text-secondary">({{ a.unidade }})</span></div>
            <div class="col-4 col-md-2">
              <input class="form-control form-control-sm" type="number" min="0" step="any" [(ngModel)]="a.quantidade" [attr.aria-label]="'Quantidade ' + a.nome">
            </div>
            <div class="col-12 col-md-4 small text-secondary">disponível {{ a.disponivel | qtd }}</div>
          </div>
        }
      }

      <div class="my-3">
        <label class="form-label" for="obs">Observações</label>
        <input id="obs" class="form-control" maxlength="500" [(ngModel)]="observacao">
      </div>
      <button class="btn btn-primary" [disabled]="salvando() || !podeEnviar()" (click)="enviar()">Enviar ao terceirizado</button>
    } @else if (erro()) {
      <div class="alert alert-danger" role="alert">{{ erro() }}</div>
    } @else {
      <p class="text-secondary">Carregando…</p>
    }
  `
})
export class RemessaFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(FaccaoService);
  private ordens = inject(OrdemProducaoService);
  private toast = inject(ToastService);
  fornecedores = inject(FornecedorService);

  ordem = signal<OrdemProducao | null>(null);
  erro = signal('');
  salvando = signal(false);
  fornecedorId: number | null = null;
  valorPeca: number | null = null;
  prazo = '';
  observacao = '';
  pecas: LinhaPeca[] = [];
  aviamentos: LinhaAviamento[] = [];

  ngOnInit() {
    const ordemId = Number(this.route.snapshot.queryParamMap.get('ordemId'));
    this.fornecedores.getAll().subscribe();
    if (!ordemId) { this.erro.set('Abra a remessa a partir de uma ordem de produção.'); return; }
    this.ordens.obter(ordemId).subscribe({
      next: o => {
        this.ordem.set(o);
        this.pecas = o.itens.map(i => ({ variacaoId: i.variacaoId, rotulo: i.variacaoSku ?? 'Peças', planejado: i.quantidade, cortado: i.cortado, quantidade: null }));
        this.aviamentos = o.materiais.map(m => ({ materialId: m.materialId, nome: m.materialNome, unidade: m.unidadeCodigo, disponivel: m.disponivel, quantidade: null }));
      },
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Ordem não encontrada.'), 'Ordem não encontrada.'))
    });
  }

  podeEnviar() {
    return !!this.fornecedorId && this.valorPeca !== null && Number(this.valorPeca) >= 0 && this.pecas.some(p => Number(p.quantidade) > 0);
  }

  enviar() {
    const o = this.ordem();
    if (!o || !this.fornecedorId) return;
    this.salvando.set(true);
    this.erro.set('');
    this.service.enviar({
      ordemId: o.id, fornecedorId: this.fornecedorId, valorPeca: Number(this.valorPeca), prazoRetorno: this.prazo || null,
      observacao: this.observacao.trim() || null,
      itens: this.pecas.filter(p => Number(p.quantidade) > 0).map(p => ({ variacaoId: p.variacaoId, quantidade: Number(p.quantidade) })),
      materiais: this.aviamentos.filter(a => Number(a.quantidade) > 0).map(a => ({ materialId: a.materialId, quantidade: Number(a.quantidade) }))
    }).subscribe({
      next: r => {
        this.salvando.set(false);
        this.toast.sucesso(`Remessa ${r.numero} enviada para ${r.fornecedorNome}.`);
        this.router.navigate(['/producao/faccao', r.id]);
      },
      error: err => {
        this.salvando.set(false);
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível enviar a remessa.'), 'Não foi possível enviar a remessa.'));
      }
    });
  }
}
