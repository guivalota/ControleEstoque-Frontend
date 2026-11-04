import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrdemProducaoService } from '../../../core/services/ordem-producao.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { OrdemProducao, ROTULO_STATUS_ORDEM, StatusOrdemProducao } from '../../../core/models/ordem-producao.model';
import { QtdPipe } from '../../../core/pipes/qtd.pipe';
import { formatarData } from '../../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

const CLASSE_STATUS: Record<StatusOrdemProducao, string> = {
  planejada: 'text-bg-secondary',
  liberada: 'text-bg-info',
  em_producao: 'text-bg-primary',
  concluida: 'text-bg-success',
  cancelada: 'text-bg-dark'
};

/** Ordens de produção da empresa, da mais nova para a mais antiga, com filtro por estado e busca por número ou produto. */
@Component({
  selector: 'app-ordens-lista',
  standalone: true,
  imports: [FormsModule, RouterLink, QtdPipe],
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0 me-auto">Ordens de produção</h1>
      @if (permissao.canCreate()) {
        <a class="btn btn-primary" routerLink="/producao/ordens/nova">Nova ordem</a>
      }
    </div>

    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-5">
        <input class="form-control" type="search" placeholder="Buscar por número, SKU ou produto" aria-label="Buscar ordem"
               [(ngModel)]="busca" (ngModelChange)="buscarComAtraso()">
      </div>
      <div class="col-12 col-md-3">
        <select class="form-select" aria-label="Estado" [(ngModel)]="status" (ngModelChange)="filtrar()">
          <option value="">Todos os estados</option>
          @for (s of estados; track s) { <option [value]="s">{{ rotulo[s] }}</option> }
        </select>
      </div>
    </div>

    @if (carregando()) {
      <p class="text-secondary">Carregando…</p>
    } @else if (ordens().length === 0) {
      <p class="text-secondary">Nenhuma ordem de produção.</p>
    } @else {
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Nº</th><th>Produto</th><th class="text-end">Peças</th><th>Prazo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (o of ordens(); track o.id) {
              <tr>
                <td>{{ o.numero }}</td>
                <td>{{ o.produtoSku }} — {{ o.produtoNome }}</td>
                <td class="text-end">{{ o.quantidadeTotal | qtd }}</td>
                <td>{{ o.prazo ? data(o.prazo) : '—' }}</td>
                <td><span class="badge" [class]="classe(o.status)">{{ rotulo[o.status] }}</span></td>
                <td class="text-end"><a class="btn btn-sm btn-outline-primary" [routerLink]="['/producao/ordens', o.id]">Abrir</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-secondary">{{ total() }} ordem(ns)</small>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() <= 1" (click)="irPara(pagina() - 1)">Anterior</button>
          <button class="btn btn-sm btn-outline-secondary" [disabled]="pagina() * TAMANHO >= total()" (click)="irPara(pagina() + 1)">Próxima</button>
        </div>
      </div>
    }
  `
})
export class OrdensListaComponent implements OnInit {
  private service = inject(OrdemProducaoService);
  private route = inject(ActivatedRoute);
  permissao = inject(PermissaoService);

  readonly TAMANHO = 20;
  readonly rotulo = ROTULO_STATUS_ORDEM;
  readonly estados = Object.keys(ROTULO_STATUS_ORDEM) as StatusOrdemProducao[];
  ordens = signal<OrdemProducao[]>([]);
  total = signal(0);
  pagina = signal(1);
  carregando = signal(true);
  erro = signal('');
  busca = '';
  status = '';
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    // o painel da Produção chega aqui com ?status=
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && this.estados.includes(status as StatusOrdemProducao)) this.status = status;
    this.carregar();
  }

  data(iso: string) {
    return formatarData(iso);
  }

  classe(status: StatusOrdemProducao) {
    return CLASSE_STATUS[status];
  }

  carregar() {
    this.carregando.set(true);
    this.service.listar(this.pagina(), this.TAMANHO, this.status || undefined, this.busca.trim() || undefined).subscribe({
      next: r => { this.ordens.set(r.items); this.total.set(r.total); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Não foi possível carregar as ordens.'), 'Não foi possível carregar as ordens.'));
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

  buscarComAtraso() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.filtrar(), 300);
  }
}
