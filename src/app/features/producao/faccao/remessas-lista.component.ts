import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaccaoService } from '../../../core/services/faccao.service';
import { Oficina, ROTULO_STATUS_REMESSA, Remessa, StatusRemessa } from '../../../core/models/faccao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

/** Terceirização: o que está em poder de cada terceirizado, remessas em aberto e atrasadas. Novas remessas saem da tela da ordem. */
@Component({
  selector: 'app-remessas-lista',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <h1 class="h4 mb-3">Terceirização</h1>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    @if (oficinas().length > 0) {
      <h2 class="h6">Terceirizados</h2>
      <div class="row g-2 mb-3">
        @for (o of oficinas(); track o.fornecedorId) {
          <div class="col-12 col-md-4">
            <div class="card card-body py-2">
              <strong>{{ o.fornecedorNome }}</strong>
              <div class="small">{{ o.pecasEmPoder | qtd }} peça(s) em poder · {{ o.remessasAbertas }} remessa(s) em aberto
                @if (o.remessasAtrasadas > 0) { <span class="badge text-bg-danger">{{ o.remessasAtrasadas }} atrasada(s)</span> }
              </div>
              <div class="small text-secondary">Valor apurado a pagar: {{ moeda(o.valorAPagar) }}</div>
            </div>
          </div>
        }
      </div>
    }

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-3">
        <select class="form-select" aria-label="Estado da remessa" [(ngModel)]="status" (ngModelChange)="filtrar()">
          <option value="">Todos os estados</option>
          @for (s of estados; track s) { <option [value]="s">{{ rotulo[s] }}</option> }
        </select>
      </div>
      <div class="col-12 col-md-4 d-flex align-items-center">
        <div class="form-check">
          <input id="so-atrasadas" class="form-check-input" type="checkbox" [(ngModel)]="soAtrasadas" (ngModelChange)="filtrar()">
          <label class="form-check-label" for="so-atrasadas">Só atrasadas</label>
        </div>
      </div>
    </div>

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else if (remessas().length === 0) {
      <p class="text-secondary">Nenhuma remessa. Envie peças cortadas ao terceirizado pela tela de uma ordem liberada ou em produção.</p>
    } @else {
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Nº</th><th>Terceirizado</th><th>Ordem</th><th class="text-end">Enviadas</th><th class="text-end">Em poder</th><th>Retorno</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (r of remessas(); track r.id) {
              <tr>
                <td>{{ r.numero }}</td>
                <td>{{ r.fornecedorNome }}</td>
                <td><a [routerLink]="['/producao/ordens', r.ordemId]">#{{ r.ordemNumero }}</a> · {{ r.produtoNome }}</td>
                <td class="text-end">{{ r.pecasEnviadas | qtd }}</td>
                <td class="text-end">{{ r.pecasEmPoder | qtd }}</td>
                <td>{{ r.prazoRetorno ? data(r.prazoRetorno) : '—' }}
                  @if (r.atrasada) { <span class="badge text-bg-danger">atrasada</span> }</td>
                <td>{{ rotulo[r.status] }}</td>
                <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/producao/faccao', r.id]">Abrir</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-secondary">{{ total() }} remessa(s)</small>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() <= 1" (click)="irPara(pagina() - 1)">Anterior</button>
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() * TAMANHO >= total()" (click)="irPara(pagina() + 1)">Próxima</button>
        </div>
      </div>
    }
  `
})
export class RemessasListaComponent implements OnInit {
  private service = inject(FaccaoService);

  readonly TAMANHO = 20;
  readonly rotulo = ROTULO_STATUS_REMESSA;
  readonly estados = Object.keys(ROTULO_STATUS_REMESSA) as StatusRemessa[];
  remessas = signal<Remessa[]>([]);
  oficinas = signal<Oficina[]>([]);
  total = signal(0);
  pagina = signal(1);
  carregando = signal(true);
  erro = signal('');
  status = '';
  soAtrasadas = false;

  ngOnInit() {
    this.service.oficinas().subscribe({ next: o => this.oficinas.set(o), error: () => this.oficinas.set([]) });
    this.carregar();
  }

  data(iso: string) {
    return formatarData(iso);
  }

  moeda(valor: number) {
    return formatarMoeda(valor);
  }

  carregar() {
    this.carregando.set(true);
    this.service.listar(this.pagina(), this.TAMANHO, { status: this.status || undefined, atrasadas: this.soAtrasadas || undefined }).subscribe({
      next: r => { this.remessas.set(r.items); this.total.set(r.total); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar as remessas.'), 'Não foi possível carregar as remessas.'));
        this.carregando.set(false);
      }
    });
  }

  filtrar() {
    this.pagina.set(1);
    this.carregar();
  }

  irPara(pagina: number) {
    this.pagina.set(pagina);
    this.carregar();
  }
}
